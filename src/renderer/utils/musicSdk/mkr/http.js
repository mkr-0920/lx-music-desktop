// [文件: src/renderer/utils/musicSdk/mkr/http.js]

import { httpFetch } from '../../request'
import { BASE_URL, API_KEY } from './config'

/**
 * 发起 GET 请求
 * @param {string} path API 路径 (例如 /search)
 * @param {object} params URL 查询参数
 * @returns {Promise<any>} JSON 响应体
 */
export const get = (path, params = {}) => {
  const url = new URL(BASE_URL + path)
  if (params) {
    url.search = new URLSearchParams(params).toString()
  }

  const options = {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY,
    },
  }

  const requestObj = httpFetch(url.toString(), options)

  // 我们返回这个 promise
  return requestObj.promise.then(resp => {
    // request.js (50行) 已经帮我们 JSON.parse(resp.body) 了
    // 我们只需要检查 API 业务代码
    if (resp.body.code !== 200) {
      // API 逻辑失败 (例如 code: 404)
      throw new Error(resp.body.message || 'API 请求失败')
    } else {
      // API 成功, 返回 data 字段
      return resp.body.data
    }
  }).catch(err => {
    // httpFetch 内部的 catch (116行) 会处理 ETIMEDOUT 等
    // 如果 .promise reject, 我们也将其抛出
    return Promise.reject(err)
  })
}
