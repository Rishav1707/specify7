import { columnToField, parseSqlQuery } from '../parseselect';

describe('parse', () => {
  test('Collecting event', () => {
    const string =
      'SELECT %s1 FROM CollectingEvent ce LEFT JOIN ce.locality loc LEFT JOIN loc.geography geo JOIN ce.discipline as dsp WHERE dsp.disciplineId = DSPLNID AND %s2 ORDER BY stationFieldNumber';
    const colMap = parseSqlQuery(string);
    expect(colMap.ce).toBe('CollectingEvent');
    expect(colMap.loc).toBe('CollectingEvent.locality');
    expect(colMap.geo).toBe('CollectingEvent.locality.geography');
    expect(colMap.dsp).toBe('CollectingEvent.discipline');
  });

  test('Field notebook page', () => {
    const string =
      'SELECT %s1 FROM FieldNotebookPage fnbp JOIN fnbp.pageSet as fnbps JOIN fnbps.fieldNotebook as fnb JOIN fnb.discipline as dsp WHERE dsp.disciplineId = DSPLNID AND %s2 ORDER BY fnb.name, fnbp.pageNumber';
    const colMap = parseSqlQuery(string);
    expect(colMap.fnbp).toBe('FieldNotebookPage');
    expect(colMap.fnbps).toBe('FieldNotebookPage.pageSet');
    expect(colMap.fnb).toBe('FieldNotebookPage.pageSet.fieldNotebook');
    expect(colMap.dsp).toBe(
      'FieldNotebookPage.pageSet.fieldNotebook.discipline'
    );
  });
});

describe('columnToField', () => {
  test('Collecting event', () => {
    const columnMap = {
      ce: 'CollectingEvent',
      loc: 'CollectingEvent.locality',
      geo: 'CollectingEvent.locality.geography',
      dsp: 'CollectingEvent.discipline',
    };
    expect(columnToField(columnMap, 'loc.localityName')).toBe(
      'locality.localityName'
    );
    expect(columnToField(columnMap, 'geo.fullName')).toBe(
      'locality.geography.fullName'
    );
  });

  test('Field notebook page', () => {
    const columnMap = {
      fnbp: 'FieldNotebookPage',
      fnbps: 'FieldNotebookPage.pageSet',
      fnb: 'FieldNotebookPage.pageSet.fieldNotebook',
      dsp: 'FieldNotebookPage.pageSet.fieldNotebook.discipline',
    };
    expect(columnToField(columnMap, 'fnbp.pageNumber')).toBe('pageNumber');
    expect(columnToField(columnMap, 'fnb.name')).toBe(
      'pageSet.fieldNotebook.name'
    );
  });
});
