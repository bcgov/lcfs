const loadI18nResources = async () => {
  const localeModules = import.meta.glob<Record<string, unknown>>(
    '../../../assets/locales/en/*.json',
    { import: 'default' }
  ) as Record<string, () => Promise<Record<string, unknown>>>
  const loadedResources = Object.fromEntries(
    await Promise.all(
      Object.entries(localeModules).map(async ([path, load]) => {
        const filename = path.split('/').pop() ?? ''
        const namespace = filename.replace(/\.json$/, '')
        return [namespace, await load()]
      })
    )
  ) as Record<string, Record<string, unknown>>

  loadedResources.report = loadedResources.reports
  loadedResources.org = loadedResources.organization
  loadedResources.txn = loadedResources.transaction
  loadedResources.administrativeAdjustment = loadedResources.adminAdjustment
  loadedResources.fse = loadedResources.finalSupplyEquipment

  return { en: loadedResources }
}

export { loadI18nResources }
