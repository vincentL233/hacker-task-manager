const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API給渲染進程
contextBridge.exposeInMainWorld('electronAPI', {
  // 獲取系統信息
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // 獲取CPU負載
  getCpuLoad: () => ipcRenderer.invoke('get-cpu-load'),
  
  // 獲取GPU負載
  getGpuLoad: () => ipcRenderer.invoke('get-gpu-load'),

  // 獲取網路與磁碟資訊
  getIoStats: () => ipcRenderer.invoke('get-io-stats'),

  // 結束處理程序
  killProcess: (pid, signal = 'SIGTERM') => ipcRenderer.invoke('kill-process', { pid, signal }),
  
  // 平台信息
  platform: process.platform,
  
  // 應用版本
  version: process.env.npm_package_version || '1.0.0'
});

// 添加窗口控制API
contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close')
});
