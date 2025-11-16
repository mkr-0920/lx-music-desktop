import { createCipheriv, createDecipheriv, publicEncrypt, randomBytes, createHash, constants } from 'crypto'
const iv = Buffer.from('0102030405060708')
const presetKey = Buffer.from('0CoJUm6Qyw8W8jud')
const linuxapiKey = Buffer.from('rFgB&h#%2?^eDg:Q')
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const publicKey = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB\n-----END PUBLIC KEY-----'
const eapiKey = 'e82ckenh8dichen8'

const aesEncrypt = (buffer, mode, key, iv) => {
  const cipher = createCipheriv(mode, key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

const aesDecrypt = function(cipherBuffer, mode, key, iv) {
  let decipher = createDecipheriv(mode, key, iv)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(cipherBuffer), decipher.final()])
}

const rsaEncrypt = (buffer, key) => {
  buffer = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer])
  return publicEncrypt({ key, padding: constants.RSA_NO_PADDING }, buffer)
}

export const weapi = object => {
  const text = JSON.stringify(object)
  const secretKey = randomBytes(16).map(n => (base62.charAt(n % 62).charCodeAt()))
  return {
    params: aesEncrypt(Buffer.from(aesEncrypt(Buffer.from(text), 'aes-128-cbc', presetKey, iv).toString('base64')), 'aes-128-cbc', secretKey, iv).toString('base64'),
    encSecKey: rsaEncrypt(secretKey.reverse(), publicKey).toString('hex'),
  }
}

export const linuxapi = object => {
  const text = JSON.stringify(object)
  return {
    eparams: aesEncrypt(Buffer.from(text), 'aes-128-ecb', linuxapiKey, '').toString('hex').toUpperCase(),
  }
}


export const eapi = (url, object) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : object
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: aesEncrypt(Buffer.from(data), 'aes-128-ecb', eapiKey, '').toString('hex').toUpperCase(),
  }
}

/**
 * 1. 接收 hex 字符串 (httpFetch 返回的 raw)
 * 2. 从 hex 转换为 buffer
 * 3. 调用 aesDecrypt
 * 4. 将解密后的 buffer 转回 utf8 字符串
 */
export const eapiDecrypt = (encryptedTextHex) => {
  try {
    const encryptedBuffer = Buffer.from(encryptedTextHex, 'hex')
    const decryptedBuffer = aesDecrypt(encryptedBuffer, 'aes-128-ecb', eapiKey, '')
    return decryptedBuffer.toString('utf8')
  } catch (err) {
    console.error('[WY eapiDecrypt] 解密失败:', err)
    return '{"code": 500, "message": "Decryption failed"}' // 返回错误 JSON
  }
}
