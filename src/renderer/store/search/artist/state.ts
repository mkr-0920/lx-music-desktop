import { reactive, markRaw } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'

export interface ListInfoItem {
  id: string
  name: string
  alias: string[]
  img: string
  albumCount: number
  musicCount: number
  source: LX.OnlineSource
  type: string
}

export interface SearchListInfo {
  list: ListInfoItem[]
  total: number
  page: number
  limit: number
  key: string | null
  noItemLabel: string
}

export const sources: LX.OnlineSource[] = markRaw([])

export const listInfos = markRaw<Partial<Record<LX.OnlineSource, SearchListInfo>>>({})
export const maxPages: Partial<Record<LX.OnlineSource, number>> = {}

for (const source of music.sources) {
  if (!(music as any)[source.id as LX.OnlineSource]?.artist?.search) continue
  sources.push(source.id as LX.OnlineSource)
  listInfos[source.id as LX.OnlineSource] = reactive<SearchListInfo>({
    page: 1,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })
  maxPages[source.id as LX.OnlineSource] = 0
}
