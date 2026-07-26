import type http from 'http'
import {
  aesEncrypt,
  aesDecrypt,
  rsaEncrypt,
  getIP,
} from '../utils/tools'
import querystring from 'node:querystring'
import { getUserSpace, createClientKeyInfo } from '../user'
import { toMD5 } from '../utils'
import { getComputerName } from '../../utils'
import { SYNC_CODE } from '@common/constants_sync'

const requestIps = new Map<string, { count: number, expiresAt: number }>()
const requestIpTTL = 15 * 60 * 1000
const maxRequestIpCount = 10_000

const getRequestInfo = (ip: string) => {
  const info = requestIps.get(ip)
  if (info && info.expiresAt <= Date.now()) {
    requestIps.delete(ip)
    return null
  }
  return info ?? null
}

const recordAuthFailed = (ip: string) => {
  const info = getRequestInfo(ip)
  if (!info && requestIps.size >= maxRequestIpCount) {
    const now = Date.now()
    for (const [key, requestInfo] of requestIps) {
      if (requestInfo.expiresAt <= now) requestIps.delete(key)
    }
    while (requestIps.size >= maxRequestIpCount) {
      const oldestIp = requestIps.keys().next().value
      if (oldestIp == null) break
      requestIps.delete(oldestIp)
    }
  }
  requestIps.delete(ip)
  requestIps.set(ip, {
    count: (info?.count ?? 0) + 1,
    expiresAt: Date.now() + requestIpTTL,
  })
}

const getAvailableIP = (req: http.IncomingMessage) => {
  let ip = getIP(req)
  return ip && (getRequestInfo(ip)?.count ?? 0) < 10 ? ip : null
}

const verifyByKey = (encryptMsg: string, userId: string) => {
  const userSpace = getUserSpace()
  const keyInfo = userSpace.dataManage.getClientKeyInfo(userId)
  if (!keyInfo) return null
  let text
  try {
    text = aesDecrypt(encryptMsg, keyInfo.key)
  } catch (err) {
    return null
  }
  // console.log(text)
  if (text.startsWith(SYNC_CODE.authMsg)) {
    const deviceName = text.replace(SYNC_CODE.authMsg, '') || 'Unknown'
    if (deviceName != keyInfo.deviceName) {
      keyInfo.deviceName = deviceName
      userSpace.dataManage.saveClientKeyInfo(keyInfo)
    }
    return aesEncrypt(SYNC_CODE.helloMsg, keyInfo.key)
  }
  return null
}

const verifyByCode = (encryptMsg: string, password: string) => {
  let key = toMD5(password).substring(0, 16)
  // const iv = Buffer.from(key.split('').reverse().join('')).toString('base64')
  key = Buffer.from(key).toString('base64')
  // console.log(req.headers.m, authCode, key)
  let text
  try {
    text = aesDecrypt(encryptMsg, key)
  } catch {
    return null
  }
  // console.log(text)
  if (text.startsWith(SYNC_CODE.authMsg)) {
    const data = text.split('\n')
    const publicKey = `-----BEGIN PUBLIC KEY-----\n${data[1]}\n-----END PUBLIC KEY-----`
    const deviceName = data[2] || 'Unknown'
    const isMobile = data[3] == 'lx_music_mobile'
    const keyInfo = createClientKeyInfo(deviceName, isMobile)
    const userSpace = getUserSpace()
    userSpace.dataManage.saveClientKeyInfo(keyInfo)
    return rsaEncrypt(Buffer.from(JSON.stringify({
      clientId: keyInfo.clientId,
      key: keyInfo.key,
      serverName: getComputerName(),
    })), publicKey)
  }
  return null
}

export const authCode = async(req: http.IncomingMessage, res: http.ServerResponse, password: string) => {
  let code = 401
  let msg: string = SYNC_CODE.msgAuthFailed

  let ip = getAvailableIP(req)
  if (ip) {
    if (typeof req.headers.m == 'string' && req.headers.m) {
      const userId = req.headers.i
      let _msg: string | null = null
      try {
        _msg = typeof userId == 'string' && userId
          ? verifyByKey(req.headers.m, userId)
          : verifyByCode(req.headers.m, password)
      } catch (err) {
        console.warn('Auth failed:', err instanceof Error ? err.message : err)
      }
      if (_msg != null) {
        msg = _msg
        code = 200
        requestIps.delete(ip)
      }
    }

    if (code != 200) {
      recordAuthFailed(ip)
    }
  } else {
    code = 403
    msg = SYNC_CODE.msgBlockedIp
  }
  // console.log(req.headers)

  res.writeHead(code)
  res.end(msg)
}

const verifyConnection = (encryptMsg: string, userId: string) => {
  const userSpace = getUserSpace()
  const keyInfo = userSpace.dataManage.getClientKeyInfo(userId)
  if (!keyInfo) return false
  let text
  try {
    text = aesDecrypt(encryptMsg, keyInfo.key)
  } catch (err) {
    return false
  }
  // console.log(text)
  return text == SYNC_CODE.msgConnect
}
export const authConnect = async(req: http.IncomingMessage) => {
  let ip = getAvailableIP(req)
  if (ip) {
    const query = querystring.parse((req.url!).split('?')[1])
    const i = query.i
    const t = query.t
    if (typeof i == 'string' && typeof t == 'string' && verifyConnection(t, i)) {
      requestIps.delete(ip)
      return
    }

    recordAuthFailed(ip)
  }
  throw new Error('failed')
}

