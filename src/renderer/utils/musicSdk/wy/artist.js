import { oldEapiRequest } from './utils/index'

const formatAlbum = item => ({
  id: String(item.id),
  name: item.name || '',
  singer: item.artist?.name || '',
  artistId: String(item.artist?.id || ''),
  publishTime: item.publishTime ? new Date(item.publishTime).toISOString().slice(0, 10) : '',
  publishTimestamp: item.publishTime || 0,
  img: item.picUrl ? `${item.picUrl}?param=300y300` : '',
  desc: item.description || '',
  size: item.size || 0,
  company: item.company || '',
  source: 'wy',
  type: 'album',
})

export default {
  search(text, page, limit = 30) {
    return oldEapiRequest('/api/cloudsearch/pc', {
      s: text,
      type: 100,
      limit,
      total: true,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      if (body.code !== 200) throw new Error('artist search failed')
      return {
        list: (body.result?.artists || []).map(item => ({
          id: String(item.id),
          name: item.name || '',
          alias: item.alias || [],
          img: item.picUrl ? `${item.picUrl}?param=300y300` : '',
          albumCount: item.albumSize || 0,
          musicCount: item.musicSize || 0,
          source: 'wy',
          type: 'artist',
        })),
        total: body.result?.artistCount || 0,
        limit,
      }
    })
  },

  getAlbums(id, page, limit = 50) {
    return oldEapiRequest(`/api/artist/albums/${id}`, {
      id: String(id),
      limit,
      offset: limit * (page - 1),
      total: true,
    }).promise.then(({ body }) => {
      if (body.code !== 200) throw new Error('artist albums load failed')
      return {
        artist: body.artist || null,
        list: (body.hotAlbums || []).map(formatAlbum),
        more: !!body.more,
      }
    })
  },
}
