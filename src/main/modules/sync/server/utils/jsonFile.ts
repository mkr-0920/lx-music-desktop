import fs from 'node:fs'

const writeFileSync = (filePath: string, data: string) => {
  const fd = fs.openSync(filePath, 'w')
  try {
    fs.writeFileSync(fd, data, 'utf8')
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

const replaceFileSync = (sourcePath: string, targetPath: string) => {
  try {
    fs.renameSync(sourcePath, targetPath)
  } catch (err: any) {
    if (!['EEXIST', 'EPERM'].includes(err.code) || !fs.existsSync(targetPath)) throw err
    fs.unlinkSync(targetPath)
    fs.renameSync(sourcePath, targetPath)
  }
}

const parseJson = <T>(data: string): T => JSON.parse(data) as T

const writeBackupSync = (filePath: string, data: string) => {
  const backupPath = `${filePath}.bak`
  const tempPath = `${backupPath}.tmp`
  try {
    writeFileSync(tempPath, data)
    replaceFileSync(tempPath, backupPath)
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}

const restoreMainFileSync = (filePath: string, data: string) => {
  const tempPath = `${filePath}.tmp`
  try {
    writeFileSync(tempPath, data)
    replaceFileSync(tempPath, filePath)
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}

const ensureValidBackupSync = (filePath: string, data: string) => {
  const backupPath = `${filePath}.bak`
  try {
    parseJson(fs.readFileSync(backupPath, 'utf8'))
  } catch {
    writeBackupSync(filePath, data)
  }
}

export const readJsonFileWithBackupSync = <T>(filePath: string, defaultValue: () => T): T => {
  const backupPath = `${filePath}.bak`
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8')
      const value = parseJson<T>(data)
      try {
        ensureValidBackupSync(filePath, data)
      } catch (err) {
        console.warn('Create JSON backup failed:', filePath, err)
      }
      return value
    } catch (err) {
      if (!fs.existsSync(backupPath)) throw err
    }
  } else if (!fs.existsSync(backupPath)) {
    return defaultValue()
  }

  const backupData = fs.readFileSync(backupPath, 'utf8')
  const value = parseJson<T>(backupData)
  restoreMainFileSync(filePath, backupData)
  console.warn('Recovered JSON file from backup:', filePath)
  return value
}

export const writeJsonFileAtomicSync = (filePath: string, value: unknown) => {
  const data = JSON.stringify(value)
  const tempPath = `${filePath}.tmp`
  try {
    writeFileSync(tempPath, data)
    if (fs.existsSync(filePath)) {
      try {
        const currentData = fs.readFileSync(filePath, 'utf8')
        parseJson(currentData)
        writeBackupSync(filePath, currentData)
      } catch {}
    }
    replaceFileSync(tempPath, filePath)
    ensureValidBackupSync(filePath, data)
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
}
