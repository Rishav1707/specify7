import { ajax } from '../../utils/ajax';
import type { Attachment } from '../DataModel/types';
import { getIcon, unknownIcon } from '../InitialContext/icons';
import { load } from '../InitialContext';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { commonText } from '../../localization/common';
import { formatUrl } from '../Router/queryString';
import { getPref } from '../InitialContext/remotePrefs';
import { schema } from '../DataModel/schema';
import type { IR } from '../../utils/types';
import { handleAjaxResponse } from '../../utils/ajax/response';
import { SerializedResource } from '../DataModel/helperTypes';
import { Http } from '../../utils/ajax/definitions';
import { getField } from '../DataModel/helpers';

type AttachmentSettings = {
  readonly collection: string;
  readonly delete: string;
  readonly getmetadata: string;
  readonly read: string;
  readonly testkey: string;
  readonly token_required_for_get: boolean;
  readonly write: string;
};

let settings: AttachmentSettings | undefined;
export const attachmentSettingsPromise = load<AttachmentSettings | IR<never>>(
  '/context/attachment_settings.json',
  'application/json'
).then((data) => {
  if (Object.keys(data).length > 0) settings = data as AttachmentSettings;
});

export const attachmentsAvailable = (): boolean => typeof settings === 'object';

const thumbnailable = new Set([
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/tiff',
  'application/pdf',
]);

function iconForMimeType(mimeType: string): {
  readonly alt: string;
  readonly src: string;
} {
  if (mimeType === 'text/plain')
    return { alt: 'text', src: getIcon('text') ?? unknownIcon };
  if (mimeType === 'text/html')
    return { alt: 'html', src: getIcon('html') ?? unknownIcon };

  const parts = mimeType.split('/');
  const type = parts[0];
  const subtype = parts[1];

  if (['audio', 'video', 'image', 'text'].includes(type))
    return { alt: type, src: getIcon(type) ?? unknownIcon };

  if (type === 'application') {
    const iconName = {
      pdf: 'pdf',
      'vnd.ms-excel': 'MSExcel',
      'vnd.ms-word': 'MSWord',
      'vnd.ms-powerpoint': 'MSPowerPoint',
    }[subtype];

    if (typeof iconName === 'string')
      return { alt: iconName, src: getIcon(iconName) ?? unknownIcon };
  }

  return { alt: commonText.unknown(), src: getIcon('unknown') ?? unknownIcon };
}

const fetchToken = async (filename: string): Promise<string | undefined> =>
  settings?.token_required_for_get === true
    ? ajax(formatUrl('/attachment_gw/get_token/', { filename }), {
        method: 'GET',
        headers: { Accept: 'text/plain' },
      }).then(({ data }) => data)
    : Promise.resolve(undefined);

export type AttachmentThumbnail = {
  readonly src: string;
  readonly alt: string | undefined;
  readonly width: number;
  readonly height: number;
};

export const fetchThumbnail = async (
  attachment: SerializedResource<Attachment>,
  scale = getPref('attachment.preview_size')
): Promise<AttachmentThumbnail | undefined> =>
  typeof attachment.mimeType === 'string' &&
  !thumbnailable.has(attachment.mimeType)
    ? {
        ...iconForMimeType(attachment.mimeType),
        width: scale,
        height: scale,
      }
    : typeof attachment.attachmentLocation === 'string'
    ? fetchToken(attachment.attachmentLocation).then((token) =>
        typeof settings === 'object'
          ? {
              src: formatUrl(settings.read, {
                coll: settings.collection,
                type: 'T',
                fileName: attachment.attachmentLocation ?? '',
                scale: scale.toString(),
                ...(typeof token === 'string' ? { token } : {}),
              }),
              alt: attachment.attachmentLocation ?? undefined,
              width: scale,
              height: scale,
            }
          : undefined
      )
    : undefined;

export const formatAttachmentUrl = (
  attachment: SerializedResource<Attachment>,
  token: string | undefined
): string | undefined =>
  typeof settings === 'object'
    ? formatUrl(settings.read, {
        coll: settings.collection,
        type: 'O',
        fileName: attachment.attachmentLocation ?? '',
        downloadName: attachment.origFilename?.replace(/^.*[/\\]/, ''),
        ...(typeof token === 'string' ? { token } : {}),
      })
    : undefined;

export const fetchOriginalUrl = async (
  attachment: SerializedResource<Attachment>
): Promise<string | undefined> =>
  typeof attachment.attachmentLocation === 'string'
    ? fetchToken(attachment.attachmentLocation).then((token) =>
        formatAttachmentUrl(attachment, token)
      )
    : Promise.resolve(undefined);

export async function uploadFile(
  file: File,
  handleProgress: (percentage: number | undefined) => void
): Promise<SpecifyResource<Attachment> | undefined> {
  if (settings === undefined) return undefined;
  const { data } = await ajax<
    Partial<{ readonly token: string; readonly attachmentlocation: string }>
  >(
    formatUrl('/attachment_gw/get_upload_params/', {
      fileName: file.name,
    }),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }
  );

  if (
    data.attachmentlocation === undefined ||
    data.token === undefined ||
    settings === undefined
  )
    return undefined;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', data.token);
  formData.append('store', data.attachmentlocation);
  formData.append('type', 'O');
  formData.append('coll', settings.collection);

  /*
   * Using XMLHttpRequest rather than fetch() because need upload
   * progress reporting, which is not yet supported by fetch API
   */
  const xhr = new XMLHttpRequest();
  xhr.upload?.addEventListener('progress', (event) =>
    handleProgress(
      event.lengthComputable ? event.loaded / event.total : undefined
    )
  );
  xhr.open('POST', settings.write);
  xhr.send(formData);
  const DONE = 4;
  await new Promise((resolve) =>
    xhr.addEventListener('readystatechange', () =>
      xhr.readyState === DONE
        ? resolve(
            handleAjaxResponse({
              expectedResponseCodes: [Http.OK],
              accept: undefined,
              response: {
                ok: xhr.status === Http.OK,
                status: xhr.status,
                url: settings!.write,
              } as Response,
              strict: true,
              text: xhr.responseText,
            })
          )
        : undefined
    )
  );
  return new schema.models.Attachment.Resource({
    attachmentlocation: data.attachmentlocation,
    mimetype: fixMimeType(file.type),
    origfilename: file.name,
    title: file.name,
    isPublic: getPref('attachment.is_public_default'),
  });
}

/**
 * A temporary workaround for mimeTypes for `.docx` and `.xlsx` files being
 * longer than the length limit on the `Attachment.mimeType` field.
 * See: https://github.com/specify/specify7/issues/1141
 * REFACTOR: remove this once that issue is fixed
 */
function fixMimeType(originalMimeType: string): string {
  const maxLength = getField(schema.models.Attachment, 'mimeType').length;
  if (maxLength === undefined || originalMimeType.length < maxLength)
    return originalMimeType;
  else {
    const mimeType = 'application/octet-stream';
    console.warn(
      `Shortened the Attachment mimeType from "${originalMimeType}"` +
        ` to "${mimeType}" due to length limit`
    );
    return mimeType;
  }
}
