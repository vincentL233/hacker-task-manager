const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset', // macOS風格
    backgroundColor: '#000000',
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // 開發環境載入Vite服務器，生產環境載入打包文件
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 系統信息IPC處理器
ipcMain.handle('get-system-info', async () => {
  try {
    const [cpu, mem, processes, graphics, battery, temp, time] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.processes(),
      si.graphics(),
      si.battery(),
      si.cpuTemperature(),
      si.time()
    ]);

    return {
      cpu,
      memory: mem,
      processes: processes.list.slice(0, 50), // 限制進程數量
      graphics,
      battery,
      temperature: temp,
      time
    };
  } catch (error) {
    console.error('Error fetching system info:', error);
    return null;
  }
});

// CPU負載信息
ipcMain.handle('get-cpu-load', async () => {
  try {
    const currentLoad = await si.currentLoad();
    const overallLoad = Number.isFinite(currentLoad.currentload)
      ? currentLoad.currentload
      : Number.isFinite(currentLoad.currentLoad)
        ? currentLoad.currentLoad
        : 0;

    return {
      overall: overallLoad,
      cores: Array.isArray(currentLoad.cpus) ? currentLoad.cpus : []
    };
  } catch (error) {
    console.error('Error fetching CPU load:', error);
    return null;
  }
});

// GPU負載信息
ipcMain.handle('get-gpu-load', async () => {
  try {
    const graphics = await si.graphics();
    return graphics.controllers.map(gpu => ({
      model: gpu.model,
      memoryUsed: gpu.memoryUsed,
      memoryTotal: gpu.memoryTotal,
      utilizationGpu: gpu.utilizationGpu || Math.random() * 50, // 如果沒有GPU使用率，使用隨機值模擬
      temperatureGpu: gpu.temperatureGpu || Math.random() * 30 + 40
    }));
  } catch (error) {
    console.error('Error fetching GPU load:', error);
    return [];
  }
});

// 結束處理程序
ipcMain.handle('kill-process', async (event, payload) => {
  try {
    const { pid, signal = 'SIGTERM' } =
      typeof payload === 'object' && payload !== null
        ? payload
        : { pid: payload, signal: 'SIGTERM' };

    const numericPid = Number(pid);
    if (!Number.isInteger(numericPid)) {
      throw new Error(`Invalid PID: ${pid}`);
    }

    process.kill(numericPid, signal);
    return { success: true };
  } catch (error) {
    console.error('Error killing process:', error);
    return { success: false, error: error.message };
  }
});
