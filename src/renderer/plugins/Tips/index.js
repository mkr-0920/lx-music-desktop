import tips from './Tips'
import { debounce } from '@common/utils'

let instance
let prevTips
let prevX = 0
let prevY = 0
let isDraging = false

const getTipText = el => {
  return el.getAttribute('aria-label') && el.getAttribute('ignore-tip') == null ? el.getAttribute('aria-label') : null
}

const getTips = el =>
  el
    ? getTipText(el)
      ? getTipText(el)
      : el.parentNode === document.documentElement
        ? null
        : getTips(el.parentNode)
    : null

const showTips = debounce(event => {
  if (isDraging) return
  let msg = getTips(event.target)?.trim()
  if (!msg) return
  prevTips = msg
  instance = tips({
    message: msg,
    autoCloseTime: 10000,
    position: {
      top: event.y + 12,
      left: event.x + 8,
    },
  }, {
    beforeClose(closeInstance) {
      if (instance !== closeInstance) return
      prevTips = null
      instance = null
    },
  })
}, 400)

const hideTips = () => {
  if (!instance) return
  instance.cancel()
}

const setTips = tips => {
  if (!instance) return
  instance.setTips(tips)
}

const updateTips = event => {
  if (isDraging) return
  if (!instance) return showTips(event)
  setTimeout(() => {
    let msg = getTips(event.target)
    if (!msg || prevTips === msg) return
    setTips(msg)
    prevTips = msg
  })
}

setTimeout(() => {
  document.body.addEventListener('mousemove', event => {
    if ((event.x == prevX && event.y == prevY) || isDraging) return
    prevX = event.x
    prevY = event.y
    hideTips()
    showTips(event)
  })

  document.body.addEventListener('click', updateTips)

  document.body.addEventListener('contextmenu', updateTips)

  window.app_event.on('focus', () => {
    hideTips()
  })
  window.app_event.on('dragStart', () => {
    isDraging = true
    hideTips()
  })
  window.app_event.on('dragEnd', () => {
    isDraging = false
  })
})

// --- Toast 全局通知 ---

let toastInstance = null

export const toast = (message, type = 'normal', time = 3000) => {
  // 1. 销毁旧实例
  if (toastInstance) toastInstance.cancel()

  // 2. 计算窗口中下方的具体坐标
  // left: 窗口宽度的一半
  // top: 窗口高度的 85% (偏下位置)
  const left = window.innerWidth * 0.5
  const top = window.innerHeight * 0.85

  // 3. 创建实例，传入计算好的坐标
  toastInstance = tips({
    message,
    autoCloseTime: time,
    position: { top, left }, // <--- 直接使用计算出的数值
  }, {
    beforeClose(closeInstance) {
      if (toastInstance === closeInstance) toastInstance = null
    },
  })

  // 4. 设置样式 (定位类型、居中修正、颜色)
  if (toastInstance && toastInstance.$el) {
    const el = toastInstance.$el

    // 必须是 fixed，这样坐标才是相对于窗口的
    el.style.position = 'fixed'

    // 修正居中：因为 left 指的是元素左边缘，所以要往回移 50% 的自身宽度
    el.style.transform = 'translate(-50%, -50%)'

    el.style.zIndex = '99999'
    el.style.pointerEvents = 'none' // 鼠标穿透

    // 颜色样式：绿底黑字
    if (type === 'error') {
      el.style.backgroundColor = 'rgba(255, 59, 48, 0.95)'
      el.style.color = '#FFFFFF'
    } else {
      // LX 主题绿
      el.style.backgroundColor = 'rgba(7, 197, 86, 0.95)'
      el.style.color = '#000000'
      el.style.fontWeight = 'bold'
    }

    el.style.padding = '10px 20px'
    el.style.borderRadius = '8px'
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
  }
}
