import { throttle } from '@common/utils/common'
import fs from 'node:fs'
import path from 'node:path'
import syncLog from '../../../log'
import { getUserConfig, type UserDataManage } from '../../user/data'
import { File } from '../../../../../../common/constants_sync'
import { checkAndCreateDirSync } from '../../utils'
import { readJsonFileWithBackupSync, writeJsonFileAtomicSync } from '../../utils/jsonFile'


interface SnapshotInfo {
  latest: string | null
  time: number
  list: string[]
  clients: Record<string, LX.Sync.Dislike.ListInfo>
}
export class SnapshotDataManage {
  userDataManage: UserDataManage
  dislikeDir: string
  snapshotDir: string
  snapshotInfoFilePath: string
  snapshotInfo: SnapshotInfo
  private readonly saveSnapshotInfoThrottle: () => void

  isIncluedsDevice = (key: string) => {
    return Object.values(this.snapshotInfo.clients).some(device => device.snapshotKey == key)
  }

  clearOldSnapshot = async() => {
    if (!this.snapshotInfo) return
    const snapshotList = this.snapshotInfo.list.filter(key => !this.isIncluedsDevice(key))
    // console.log(snapshotList.length, lx.config.maxSnapshotNum)
    const userMaxSnapshotNum = getUserConfig(this.userDataManage.userName).maxSnapshotNum
    let requiredSave = snapshotList.length > userMaxSnapshotNum
    while (snapshotList.length > userMaxSnapshotNum) {
      const name = snapshotList.pop()
      if (name) {
        await this.removeSnapshot(name)
        this.snapshotInfo.list.splice(this.snapshotInfo.list.indexOf(name), 1)
      } else break
    }
    if (requiredSave) this.saveSnapshotInfo(this.snapshotInfo)
  }

  updateDeviceSnapshotKey = async(clientId: string, key: string) => {
    // console.log('updateDeviceSnapshotKey', key)
    let client = this.snapshotInfo.clients[clientId]
    if (!client) client = this.snapshotInfo.clients[clientId] = { snapshotKey: '', lastSyncDate: 0 }
    client.snapshotKey = key
    client.lastSyncDate = Date.now()
    this.saveSnapshotInfoThrottle()
  }

  getDeviceCurrentSnapshotKey = async(clientId: string) => {
    // console.log('updateDeviceSnapshotKey', key)
    const client = this.snapshotInfo.clients[clientId]
    return client?.snapshotKey
  }

  getSnapshotInfo = async(): Promise<SnapshotInfo> => {
    return this.snapshotInfo
  }

  saveSnapshotInfo = (info: SnapshotInfo) => {
    this.snapshotInfo = info
    this.saveSnapshotInfoThrottle()
  }

  removeSnapshotInfo = (clientId: string) => {
    let client = this.snapshotInfo.clients[clientId]
    if (!client) return
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.snapshotInfo.clients[clientId]
    this.saveSnapshotInfoThrottle()
  }

  getSnapshot = async(name: string) => {
    const filePath = path.join(this.snapshotDir, `snapshot_${name}`)
    let listData: LX.Dislike.DislikeRules
    try {
      listData = (await fs.promises.readFile(filePath)).toString('utf-8')
    } catch (err) {
      syncLog.warn(err)
      return null
    }
    return listData
  }

  saveSnapshot = async(name: string, data: string) => {
    syncLog.info('saveSnapshot', this.userDataManage.userName, name)
    const filePath = path.join(this.snapshotDir, `snapshot_${name}`)
    try {
      fs.writeFileSync(filePath, data)
    } catch (err) {
      syncLog.error(err)
      throw err
    }
  }

  removeSnapshot = async(name: string) => {
    syncLog.info('removeSnapshot', this.userDataManage.userName, name)
    const filePath = path.join(this.snapshotDir, `snapshot_${name}`)
    try {
      fs.unlinkSync(filePath)
    } catch (err) {
      syncLog.error(err)
    }
  }


  constructor(userDataManage: UserDataManage) {
    this.userDataManage = userDataManage

    this.dislikeDir = path.join(userDataManage.userDir, File.dislikeDir)
    checkAndCreateDirSync(this.dislikeDir)

    this.snapshotDir = path.join(this.dislikeDir, File.dislikeSnapshotDir)
    checkAndCreateDirSync(this.snapshotDir)

    this.snapshotInfoFilePath = path.join(this.dislikeDir, File.dislikeSnapshotInfoJSON)
    this.snapshotInfo = readJsonFileWithBackupSync<SnapshotInfo>(this.snapshotInfoFilePath, () => ({ latest: null, time: 0, list: [], clients: {} }))

    this.saveSnapshotInfoThrottle = throttle(() => {
      try {
        writeJsonFileAtomicSync(this.snapshotInfoFilePath, this.snapshotInfo)
        void this.clearOldSnapshot()
      } catch (err) {
        syncLog.error(err)
      }
    })
  }
}
// type UserDataManages = Map<string, UserDataManage>

// export const createUserDataManage = (user: LX.UserConfig) => {
//   const manage = Object.create(userDataManage) as typeof userDataManage
//   manage.userDir = user.dataPath
// }
