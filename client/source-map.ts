/** RN-web turns `dataSet` into data-* attributes; native ignores it. */
export function blockDataSet(map: [number, number] | null | undefined) {
  return map ? { dataSet: { q5mLines: `${map[0]}:${map[1]}` } } : {};
}

export function formulaDataSet(source: string) {
  return { dataSet: { q5mMath: source } };
}
