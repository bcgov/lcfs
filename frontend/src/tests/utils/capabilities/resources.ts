import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { i18n as I18nInstance } from 'i18next'

type Resource = Record<string, unknown>

type LazyI18nInstance = {
  readonly addResourceBundle: (...args: unknown[]) => unknown
  hasResourceBundle: (...args: unknown[]) => boolean
  getFixedT: (...args: unknown[]) => unknown
  t: (...args: unknown[]) => unknown
  readonly options: { readonly defaultNS?: unknown }
}

const namespaceFiles: Record<string, string> = {
  common: 'common',
  organization: 'organization',
  org: 'organization',
  admin: 'admin',
  reports: 'reports',
  report: 'reports',
  fuelCode: 'fuelCode',
  transaction: 'transaction',
  txn: 'transaction',
  transfer: 'transfer',
  internalComment: 'internalComment',
  adminAdjustment: 'adminAdjustment',
  administrativeAdjustment: 'adminAdjustment',
  initiativeAgreement: 'initiativeAgreement',
  notionalTransfer: 'notionalTransfer',
  otherUses: 'otherUses',
  finalSupplyEquipment: 'finalSupplyEquipment',
  fse: 'finalSupplyEquipment',
  fuelSupply: 'fuelSupply',
  fuelExport: 'fuelExport',
  dashboard: 'dashboard',
  allocationAgreement: 'allocationAgreement',
  notifications: 'notifications',
  creditMarket: 'creditMarket',
  chargingEquipment: 'chargingEquipment',
  chargingSite: 'chargingSite',
  bulletins: 'bulletins',
  carbonIntensity: 'carbonIntensity',
  releaseNotes: 'releaseNotes'
}

const resources = new Map<string, Resource>()

const loadResource = (filename: string) => {
  let resource = resources.get(filename)
  if (!resource) {
    resource = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'src/assets/locales/en', `${filename}.json`),
        'utf8'
      )
    ) as Resource
    resources.set(filename, resource)
  }
  return resource
}

const getNamespaces = (namespaces: unknown) => {
  if (Array.isArray(namespaces)) {
    return namespaces.filter(
      (namespace): namespace is string => typeof namespace === 'string'
    )
  }
  return typeof namespaces === 'string' ? [namespaces] : []
}

const configureLazyI18n = (instance: I18nInstance) => {
  const target = instance as unknown as LazyI18nInstance
  const loadedNamespaces = new Set<string>()

  const loadNamespace = (namespace: string) => {
    const filename = namespaceFiles[namespace]
    if (!filename || loadedNamespaces.has(namespace)) {
      return
    }

    target.addResourceBundle(
      'en',
      namespace,
      loadResource(filename),
      true,
      true
    )
    loadedNamespaces.add(namespace)
  }

  const loadNamespaces = (namespaces: unknown) => {
    getNamespaces(namespaces).forEach(loadNamespace)
  }

  const originalHasResourceBundle = target.hasResourceBundle.bind(target)
  target.hasResourceBundle = (language, namespace) => {
    if (language === 'en') {
      loadNamespaces(namespace)
    }
    return originalHasResourceBundle(language, namespace)
  }

  const originalGetFixedT = target.getFixedT.bind(target)
  target.getFixedT = (...args) => {
    loadNamespaces(args[1] || target.options.defaultNS)
    return originalGetFixedT(...args)
  }

  const originalT = target.t.bind(target)
  target.t = (key, options, ...rest) => {
    const namespace =
      typeof options === 'object' && options !== null && 'ns' in options
        ? options.ns
        : typeof key === 'string' && key.includes(':')
          ? key.split(':', 1)[0]
          : target.options.defaultNS
    loadNamespaces(namespace)
    return originalT(key, options, ...rest)
  }
}

export { configureLazyI18n }
