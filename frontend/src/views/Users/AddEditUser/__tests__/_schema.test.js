import { describe, it, expect, vi } from 'vitest'
import {
  userInfoSchema,
  defaultValues,
  adminRoleOptions,
  idirRoleOptions,
  iaRoleOptions,
  bceidRoleOptions,
  iaSignerOption
} from '../_schema'
import { roles } from '@/constants/roles'

const t = (key) => key

// ---------------------------------------------------------------------------
// defaultValues
// ---------------------------------------------------------------------------
describe('defaultValues', () => {
  it('includes iaRole as an empty string', () => {
    expect(defaultValues.iaRole).toBe('')
  })

  it('includes all expected fields', () => {
    expect(defaultValues).toMatchObject({
      adminRole: [],
      idirRole: '',
      iaRole: '',
      bceidRoles: [],
      readOnly: ''
    })
  })
})

// ---------------------------------------------------------------------------
// adminRoleOptions
// ---------------------------------------------------------------------------
describe('adminRoleOptions', () => {
  it('returns two options: Administrator and System Admin', () => {
    const opts = adminRoleOptions(t)
    expect(opts).toHaveLength(2)
    expect(opts[0].label).toBe(roles.administrator)
    expect(opts[1].label).toBe('System Admin')
  })

  it('System Admin value lowercases to "system admin"', () => {
    const [, sysAdmin] = adminRoleOptions(t)
    expect(sysAdmin.value).toBe('system admin')
  })

  it('System Admin text key is admin:userForm.system_admin', () => {
    const [, sysAdmin] = adminRoleOptions(t)
    expect(sysAdmin.text).toBe('admin:userForm.system_admin')
  })
})

// ---------------------------------------------------------------------------
// idirRoleOptions
// ---------------------------------------------------------------------------
describe('idirRoleOptions', () => {
  it('returns Director, Analyst, Compliance Manager in that order', () => {
    const opts = idirRoleOptions(t)
    expect(opts.map((o) => o.label)).toEqual([
      roles.director,
      roles.analyst,
      roles.compliance_manager
    ])
  })

  it('values are lower-cased role names', () => {
    const opts = idirRoleOptions(t)
    opts.forEach((opt) => {
      expect(opt.value).toBe(opt.label.toLowerCase())
    })
  })
})

// ---------------------------------------------------------------------------
// iaRoleOptions
// ---------------------------------------------------------------------------
describe('iaRoleOptions', () => {
  it('returns IA Analyst and IA Manager', () => {
    const opts = iaRoleOptions(t)
    expect(opts.map((o) => o.label)).toEqual([roles.ia_analyst, roles.ia_manager])
  })

  it('values use lowercase with space preserved', () => {
    const opts = iaRoleOptions(t)
    expect(opts[0].value).toBe('ia analyst')
    expect(opts[1].value).toBe('ia manager')
  })
})

// ---------------------------------------------------------------------------
// bceidRoleOptions — IA Signer must NOT be in the list
// ---------------------------------------------------------------------------
describe('bceidRoleOptions', () => {
  it('does not include IA Signer (rendered separately)', () => {
    const opts = bceidRoleOptions(t)
    const values = opts.map((o) => o.label)
    expect(values).not.toContain(roles.ia_signer)
  })

  it('includes IA Proponent', () => {
    const opts = bceidRoleOptions(t)
    const values = opts.map((o) => o.label)
    expect(values).toContain(roles.ia_proponent)
  })

  it('returns 6 options', () => {
    expect(bceidRoleOptions(t)).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// iaSignerOption
// ---------------------------------------------------------------------------
describe('iaSignerOption', () => {
  it('returns a single option for IA Signer', () => {
    const opt = iaSignerOption(t)
    expect(opt.label).toBe(roles.ia_signer)
    expect(opt.value).toBe('ia signer')
    expect(opt.text).toBe('admin:userForm.ia_signer')
  })
})

// ---------------------------------------------------------------------------
// userInfoSchema — director / IA conflict validation
// ---------------------------------------------------------------------------
describe('userInfoSchema director-ia-conflict', () => {
  const baseValid = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    jobTitle: 'Engineer',
    userName: 'ada',
    keycloakEmail: 'ada@example.com',
    adminRole: [],
    idirRole: '',
    iaRole: '',
    bceidRoles: [],
    readOnly: ''
  }

  it('passes when Director is selected without an IA role', async () => {
    const schema = userInfoSchema('idir')
    await expect(
      schema.validate({ ...baseValid, idirRole: roles.director.toLowerCase() })
    ).resolves.toBeTruthy()
  })

  it('passes when an IA role is selected without Director', async () => {
    const schema = userInfoSchema('idir')
    await expect(
      schema.validate({
        ...baseValid,
        idirRole: roles.analyst.toLowerCase(),
        iaRole: roles.ia_analyst.toLowerCase()
      })
    ).resolves.toBeTruthy()
  })

  it('fails when Director is combined with an IA role', async () => {
    const schema = userInfoSchema('idir')
    await expect(
      schema.validate({
        ...baseValid,
        idirRole: roles.director.toLowerCase(),
        iaRole: roles.ia_analyst.toLowerCase()
      })
    ).rejects.toThrow('Director cannot be combined with IA analyst or IA manager roles.')
  })

  it('passes when idirRole is empty and iaRole is set', async () => {
    const schema = userInfoSchema('idir')
    await expect(
      schema.validate({
        ...baseValid,
        idirRole: '',
        iaRole: roles.ia_manager.toLowerCase()
      })
    ).resolves.toBeTruthy()
  })

  it('jobTitle is optional for bceid user type', async () => {
    const schema = userInfoSchema('bceid')
    await expect(
      schema.validate({ ...baseValid, jobTitle: '' })
    ).resolves.toBeTruthy()
  })

  it('jobTitle is required for idir user type', async () => {
    const schema = userInfoSchema('idir')
    await expect(
      schema.validate({ ...baseValid, jobTitle: '' })
    ).rejects.toThrow('Job title is required.')
  })
})
