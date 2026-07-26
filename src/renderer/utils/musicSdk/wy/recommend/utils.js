import { appSetting } from '@renderer/store/setting'
import { toast } from '@renderer/plugins/Tips'

export const getRequestOptions = (forceOs = null) => {
  let wyCookie = appSetting['common.wyCookie']
  if (!wyCookie) {
    toast('请先在设置中填写网易云 Cookie')
    return 'mobile'
  }

  if (forceOs) {
    if (/os=[^;]+/.test(wyCookie)) {
      wyCookie = wyCookie.replace(/os=[^;]+/, `os=${forceOs}`)
    } else {
      wyCookie += `; os=${forceOs}`
    }

    if (/appver=[^;]+/.test(wyCookie)) {
      wyCookie = wyCookie.replace(/appver=[^;]+/, 'appver=9.9.9')
    } else {
      wyCookie += '; appver=9.9.9'
    }
  }

  return {
    mobile: true,
    headers: {
      Cookie: wyCookie,
    },
  }
}
