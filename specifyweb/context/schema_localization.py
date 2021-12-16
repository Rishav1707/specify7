import json
import logging
logger = logging.getLogger(__name__)

from django.conf import settings
from django.db import connection


def get_schema_languages():
    cursor = connection.cursor()

    cursor.execute("""
    SELECT DISTINCT
        lower(`language`),
        lower(`country`),
        lower(`variant`)
    FROM splocaleitemstr;
    """)

    return list(cursor.fetchall())

def get_schema_localization(collection, schematype, lang):
    disc = collection.discipline
    language_, country_ = lang.lower().split('-') if '-' in lang else (lang, None)

    schema_languages = get_schema_languages()

    possible = [p for p in [
        (language_, country_, None),
        (language_, None, None),
        ('en', None, None),
    ] if p in schema_languages]
    assert possible

    language, country, variant = possible[0]
    logger.info('returning %s for requested %s', (language, country, variant), lang)

    cursor = connection.cursor()

    # # It's possible to generate the json in the DB as follows:

    # cursor.execute("""
    # select json_objectagg(
    #   name, json_object(
    #     'format', format,
    #     'ishidden', ishidden != 0,
    #     'isuiformatter', isuiformatter != 0,
    #     'picklistname', picklistname,
    #     'type', type,
    #     'aggregator', aggregator,
    #     'defaultui', defaultui,
    #     'name', n.text,
    #     'desc', d.text,
    #     'items', json_merge('{}', items.items)
    # ))
    # from splocalecontainer
    # left outer join (
    #        select splocalecontainerid, json_objectagg(
    #        lower(name), json_object(
    #          'format', format,
    #          'ishidden', ishidden != 0,
    #          'isuiformatter', isuiformatter != 0,
    #          'picklistname', picklistname,
    #          'type', type,
    #          'isrequired', isrequired != 0,
    #          'weblinkname', weblinkname,
    #          'name', n.text,
    #          'desc', d.text
    #       )) as items
    #       from splocalecontaineritem item
    #       left outer join splocaleitemstr n on n.splocalecontaineritemnameid = item.splocalecontaineritemid and n.language = %s
    #       left outer join splocaleitemstr d on d.splocalecontaineritemdescid = item.splocalecontaineritemid and d.language = %s
    #       group by splocalecontainerid
    # ) items using (splocalecontainerid)
    # left outer join splocaleitemstr n on n.splocalecontainernameid = splocalecontainerid and n.language = %s
    # left outer join splocaleitemstr d on d.splocalecontainerdescid = splocalecontainerid and d.language = %s
    # where schematype = %s and disciplineid = %s
    # """, [lang, lang, lang, lang, schematype, disc.id])

    # return cursor.fetchone()[0]

    cursor.execute(f"""
    select name, format, ishidden, isuiformatter, picklistname, type, aggregator, defaultui,
           coalesce(n.text, name), coalesce(d.text, name)
    from splocalecontainer

    left outer join splocaleitemstr n on n.splocalecontainernameid = splocalecontainerid
    and n.language = %(language)s
    and n.country {'= %(country)s' if country is not None else 'is null'}
    and n.variant is null

    left outer join splocaleitemstr d on d.splocalecontainerdescid = splocalecontainerid
    and d.language = %(language)s
    and d.country {'= %(country)s' if country is not None else 'is null'}
    and d.variant is null

    where schematype = %(schematype)s and disciplineid = %(disciplineid)s
    order by name
    """, {'language': language, 'country': country, 'schematype': schematype, 'disciplineid': disc.id})

    cfields = ('format', 'ishidden', 'isuiformatter', 'picklistname', 'type', 'aggregator', 'defaultui', 'name', 'desc')

    containers = {
        row[0]: dict(items={}, **{field: row[i+1] for i, field in enumerate(cfields)})
        for row in cursor.fetchall()
    }

    cursor.execute(f"""
    select container.name, item.name,
           item.format, item.ishidden, item.isuiformatter, item.picklistname,
           item.type, item.isrequired, item.weblinkname,
           coalesce(n.text, item.name), coalesce(d.text, item.name)
    from splocalecontainer container
    inner join splocalecontaineritem item on item.splocalecontainerid = container.splocalecontainerid

    left outer join splocaleitemstr n on n.splocalecontaineritemnameid = item.splocalecontaineritemid
    and n.language = %(language)s
    and n.country {'= %(country)s' if country is not None else 'is null'}
    and n.variant is null

    left outer join splocaleitemstr d on d.splocalecontaineritemdescid = item.splocalecontaineritemid
    and d.language = %(language)s
    and d.country {'= %(country)s' if country is not None else 'is null'}
    and d.variant is null

    where schematype = %(schematype)s and disciplineid = %(disciplineid)s
    order by item.name
    """, {'language': language, 'country': country, 'schematype': schematype, 'disciplineid': disc.id})


    ifields = ('format', 'ishidden', 'isuiformatter', 'picklistname', 'type', 'isrequired', 'weblinkname', 'name', 'desc')

    for row in cursor.fetchall():
        containers[row[0]]['items'][row[1].lower()] = {field: row[i+2] for i, field in enumerate(ifields)}

    return json.dumps(containers)

