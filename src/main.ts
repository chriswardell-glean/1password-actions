import * as core from '@actions/core'
import {OnePasswordConnect} from '@1password/connect'
import * as parsing from './parsing'

// Create new connector with HTTP Pooling
const op = OnePasswordConnect({
  serverURL: core.getInput('connect-server-url'),
  token: core.getInput('connect-server-token'),
  keepAlive: true
})

const getVaultID = async (vaultName: string): Promise<string | undefined> => {
  try {
    const vaults = await op.listVaults()
    for (const vault of vaults) {
      if (vault.name === vaultName) {
        return vault.id
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

const getSecret = async (
  vaultID: string,
  secretTitle: string,
  fieldName: string,
  outputString: string,
  outputOverriden: boolean
): Promise<void> => {
  try {
    const vaultItems = await op.getItemByTitle(vaultID, secretTitle)

    const secretFields = vaultItems['fields'] || []
    for (const items of secretFields) {
      if (fieldName && items.label !== fieldName) {
        continue
      }
      if (items.value != null) {
        let outputName = `${outputString}_${items.label?.toLowerCase()}`
        if (fieldName && outputOverriden) {
          outputName = outputString
        }
        setOutput(outputName, items.value.toString())
        setEnvironmental(outputName, items.value.toString())
        if (fieldName) {
          break
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

const setOutput = async (
  outputName: string,
  secretValue: string
): Promise<void> => {
  try {
    core.setSecret(secretValue)
    core.setOutput(outputName, secretValue)
    core.info(`Secret ready for use: ${outputName}`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

const setEnvironmental = async (
  outputName: string,
  secretValue: string
): Promise<void> => {
  try {
    if (core.getInput('export-env-vars') === 'true') {
      core.setSecret(secretValue)
      core.exportVariable(outputName, secretValue)
      core.info(
        `Environmental variable globally ready for use in pipeline: ${outputName}`
      )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

async function run(): Promise<void> {
  try {
    // Translate the vault path into it's respective segments
    const secretPath = core.getInput('secret-path')
    const itemRequests = parsing.parseItemRequestsInput(secretPath)
    for (const itemRequest of itemRequests) {
      // Get the vault ID for the vault
      const secretVault = itemRequest.vault
      const vaultID = await getVaultID(secretVault)
      // Set the secrets fields
      const secretTitle = itemRequest.name
      const fieldName = itemRequest.field
      const outputString = itemRequest.outputName
      const outputOverriden = itemRequest.outputOverriden
      if (vaultID !== undefined) {
        getSecret(
          vaultID,
          secretTitle,
          fieldName,
          outputString,
          outputOverriden
        )
      } else {
        core.setFailed("Can't find vault.")
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
