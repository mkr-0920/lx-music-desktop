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

  return requestObj.promise.then(resp => {
    // request.js (50行) 已经 JSON.parse(resp.body) 了
    if (resp.body.code !== 200) {
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

export const post = (path, data = {}) => {
  const url = new URL(BASE_URL + path)

  const options = {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    // request.js 会自动 stringify 它 (因为 json: true)
    body: data,
  }
  const requestObj = httpFetch(url.toString(), options)

  return requestObj.promise.then(resp => {
    // 假设 request.js 已经 JSON.parse(resp.body)
    if (resp.body.code !== 200) {
      throw new Error(resp.body.message || 'API 请求失败')
    } else {
      // API 成功, 返回 data 字段
      return resp.body.data
    }
  }).catch(err => {
    // httpFetch 内部的 catch 会处理 ETIMEDOUT 等
    return Promise.reject(err)
  })
}
