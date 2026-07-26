import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { throttle } from '@common/utils/common'
import { filterFileName, toMD5 } from '../utils'
import { File } from '@common/constants_sync'
import { exists } from '../../utils'
import { readJsonFileWithBackupSync, writeJsonFileAtomicSync } from '../utils/jsonFile'


interface ServerInfo {
  serverId: string
  version: number
}
interface DevicesInfo {
  userName: string
  clients: Record<string, LX.Sync.ServerKeyInfo>
}
const saveServerInfoThrottle = throttle(() => {
  try {
    writeJsonFileAtomicSync(path.join(global.lxDataPath, File.serverDataPath, File.serverInfoJSON), serverInfo)
  } catch (err) {
    console.error(err)
  }
})
let serverInfo: ServerInfo
export const initServerInfo = async() => {
  if (serverInfo != null) return
  const syncDataPath = path.join(global.lxDataPath, File.serverDataPath)
  if (!await exists(syncDataPath)) await fs.promises.mkdir(syncDataPath, { recursive: true })

  const serverInfoFilePath = path.join(global.lxDataPath, File.serverDataPath, File.serverInfoJSON)
  const hasServerInfo = fs.existsSync(serverInfoFilePath) || fs.existsSync(`${serverInfoFilePath}.bak`)
  // eslint-disable-next-line require-atomic-updates
  serverInfo = readJsonFileWithBackupSync<ServerInfo>(serverInfoFilePath, () => ({
    serverId: randomBytes(4 * 4).toString('base64'),
    version: 2,
  }))
  if (!hasServerInfo) saveServerInfoThrottle()
}
export const getServerId = () => {
  return serverInfo.serverId
}
export const getVersion = async() => {
  await initServerInfo()
  return serverInfo.version ?? 1
}
export const setVersion = async(version: number) => {
  await initServerInfo()
  serverInfo.version = version
  saveServerInfoThrottle()
}

export const getUserDirname = (userName: string) => `${filterFileName(userName)}_${toMD5(userName).substring(0, 6)}`

export const getUserConfig = (userName: string) => {
  return {
    maxSnapshotNum: global.lx.appSetting['sync.server.maxSsnapshotNum'],
    'list.addMusicLocationType': global.lx.appSetting['list.addMusicLocationType'],
  }
}


// 读取所有用户目录下的devicesInfo信息，建立clientId与用户的对应关系，用于非首次连接
// let deviceUserMap: Map<string, string> = new Map<string, string>()
// const init
// for (const deviceInfo of fs.readdirSync(syncDataPath).map(dirname => {
//   const devicesFilePath = path.join(syncDataPath, dirname, File.userDevicesJSON)
//   if (fs.existsSync(devicesFilePath)) {
//     const devicesInfo = JSON.parse(fs.readFileSync(devicesFilePath).toString()) as DevicesInfo
//     if (getUserDirname(devicesInfo.userName) == dirname) return { userName: devicesInfo.userName, devices: devicesInfo.clients }
//   }
//   return { userName: '', devices: {} }
// })) {
//   for (const device of Object.values(deviceInfo.devices)) {
//     if (deviceInfo.userName) deviceUserMap.set(device.clientId, deviceInfo.userName)
//   }
// }
// export const getUserName = (clientId: string): string | null => {
//   if (!clientId) return null
//   return deviceUserMap.get(clientId) ?? null
// }
// export const setUserName = (clientId: string, dir: string) => {
//   deviceUserMap.set(clientId, dir)
// }
// export const deleteUserName = (clientId: string) => {
//   deviceUserMap.delete(clientId)
// }

export const createClientKeyInfo = (deviceName: string, isMobile: boolean): LX.Sync.ServerKeyInfo => {
  const keyInfo: LX.Sync.ServerKeyInfo = {
    clientId: randomBytes(4 * 4).toString('base64'),
    key: randomBytes(16).toString('base64'),
    deviceName,
    isMobile,
    lastConnectDate: 0,
  }
  return keyInfo
}

export class UserDataManage {
  userName: string
  userDir: string
  devicesFilePath: string
  devicesInfo: DevicesInfo
  private readonly saveDevicesInfoThrottle: () => void

  getAllClientKeyInfo = () => {
    return Object.values(this.devicesInfo.clients).sort((a, b) => (b.lastConnectDate ?? 0) - (a.lastConnectDate ?? 0))
  }

  saveClientKeyInfo = (keyInfo: LX.Sync.ServerKeyInfo) => {
    const maxDeviceCount = 100
    if (this.devicesInfo.clients[keyInfo.clientId] == null && Object.keys(this.devicesInfo.clients).length >= maxDeviceCount) throw new Error('max keys')
    this.devicesInfo.clients[keyInfo.clientId] = keyInfo
    this.saveDevicesInfoThrottle()
  }

  getClientKeyInfo = (clientId?: string | null): LX.Sync.ServerKeyInfo | null => {
    if (!clientId) return null
    return this.devicesInfo.clients[clientId] ?? null
  }

  removeClientKeyInfo = async(clientId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.devicesInfo.clients[clientId]
    this.saveDevicesInfoThrottle()
  }

  isIncluedsClient = (clientId: string) => {
    return Object.values(this.devicesInfo.clients).some(client => client.clientId == clientId)
  }

  constructor(userName: string) {
    this.userName = userName
    const syncDataPath = path.join(global.lxDataPath, File.serverDataPath)
    fs.mkdirSync(syncDataPath, { recursive: true })
    this.userDir = syncDataPath
    this.devicesFilePath = path.join(this.userDir, File.userDevicesJSON)
    this.devicesInfo = readJsonFileWithBackupSync<DevicesInfo>(this.devicesFilePath, () => ({ userName, clients: {} }))

    this.saveDevicesInfoThrottle = throttle(() => {
      try {
        writeJsonFileAtomicSync(this.devicesFilePath, this.devicesInfo)
      } catch (err) {
        console.error(err)
      }
    })
  }
}
// type UserDataManages = Map<string, UserDataManage>

// export const createUserDataManage = (user: LX.UserConfig) => {
//   const manage = Object.create(userDataManage) as typeof userDataManage
//   manage.userDir = user.dataPath
// }
