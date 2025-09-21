import React, { useState, useEffect, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import PerformanceView from './views/PerformanceView'
import ProcessView from './views/ProcessView'
import StatusBar from './components/StatusBar'
import SettingsModal from './components/SettingsModal'

const SETTINGS_STORAGE_KEY = 'htm-settings';
const MIN_UPDATE_INTERVAL = 500;
const MIN_HISTORY_LENGTH = 10;
const MAX_HISTORY_LENGTH = 360;
const defaultSettings = {
  updateInterval: 2000,
  historyLength: 60,
  defaultPerformanceTab: 'cpu',
  enabledCards: {
    cpu: true,
    gpu: true,
    network: true,
    storage: true
  }
};

const createHistoryArray = (length) => Array.from({ length }, () => 0);

const adjustHistoryArray = (array, length) => {
  const safeArray = Array.isArray(array) ? [...array] : [];
  if (safeArray.length > length) {
    return safeArray.slice(safeArray.length - length);
  }
  if (safeArray.length < length) {
    return Array.from({ length: length - safeArray.length }, () => 0).concat(safeArray);
  }
  return safeArray;
};

const PERFORMANCE_TABS = [
  { id: 'cpu', label: 'CPU' },
  { id: 'gpu', label: 'GPU', requireGpu: true },
  { id: 'network', label: 'Network' },
  { id: 'storage', label: 'Storage' }
];

const TaskManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('cpu');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTab, setSelectedTab] = useState('processes');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [selectedPid, setSelectedPid] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(defaultSettings);
  
  // 系統數據狀態
  const [systemInfo, setSystemInfo] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [cpuLoad, setCpuLoad] = useState(null);
  const [gpuLoad, setGpuLoad] = useState([]);
  const [selectedGpuIndex, setSelectedGpuIndex] = useState(0);
  const [gpuHistory, setGpuHistory] = useState([]);
  const [performanceTab, setPerformanceTab] = useState(defaultSettings.defaultPerformanceTab);
  const [networkStats, setNetworkStats] = useState([]);
  const [networkInterfaces, setNetworkInterfaces] = useState([]);
  const [fsStats, setFsStats] = useState(null);
  const [diskStats, setDiskStats] = useState(null);
  const [storageDevices, setStorageDevices] = useState([]);

  const historyLength = Math.min(
    MAX_HISTORY_LENGTH,
    Math.max(MIN_HISTORY_LENGTH, settings.historyLength || defaultSettings.historyLength)
  );
  const updateInterval = Math.max(MIN_UPDATE_INTERVAL, settings.updateInterval || defaultSettings.updateInterval);

  const appendHistory = (prevArray, value) => {
    const baseArray = Array.isArray(prevArray) ? [...prevArray, value] : [value];
    if (baseArray.length > historyLength) {
      baseArray.splice(0, baseArray.length - historyLength);
    }
    if (baseArray.length < historyLength) {
      return Array.from({ length: historyLength - baseArray.length }, () => 0).concat(baseArray);
    }
    return baseArray;
  };

  const tabsForRender = PERFORMANCE_TABS.map(tab => {
    const enabled = settings.enabledCards?.[tab.id] !== false;
    const dataAvailable = !(tab.requireGpu && gpuLoad.length === 0);
    return {
      ...tab,
      disabled: !enabled || !dataAvailable
    };
  });

  const availableTabs = tabsForRender.filter(tab => !tab.disabled);
  const [performanceHistory, setPerformanceHistory] = useState(() => ({
    cpu: createHistoryArray(defaultSettings.historyLength),
    memory: createHistoryArray(defaultSettings.historyLength),
    gpu: createHistoryArray(defaultSettings.historyLength),
    netUp: createHistoryArray(defaultSettings.historyLength),
    netDown: createHistoryArray(defaultSettings.historyLength),
    diskRead: createHistoryArray(defaultSettings.historyLength),
    diskWrite: createHistoryArray(defaultSettings.historyLength)
  }));
  // 檢測是否在Electron環境中
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI);
  }, []);

  // 檢測螢幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSettingsLoaded(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const mergedSettings = {
          ...defaultSettings,
          ...parsed,
          enabledCards: {
            ...defaultSettings.enabledCards,
            ...(parsed?.enabledCards || {})
          }
        };
        mergedSettings.enabledCards.cpu = true;
        mergedSettings.updateInterval = Number(mergedSettings.updateInterval) || defaultSettings.updateInterval;
        mergedSettings.historyLength = Number(mergedSettings.historyLength) || defaultSettings.historyLength;
        setSettings(mergedSettings);
        if (mergedSettings.defaultPerformanceTab) {
          setPerformanceTab(mergedSettings.defaultPerformanceTab);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings, settingsLoaded]);

  useEffect(() => {
    if (availableTabs.length === 0) {
      setPerformanceTab('cpu');
      return;
    }
    if (!availableTabs.some(tab => tab.id === performanceTab)) {
      setPerformanceTab(availableTabs[0].id);
    }
  }, [availableTabs, performanceTab]);

  useEffect(() => {
    if (!settingsLoaded) return;
    setPerformanceHistory(prev => ({
      cpu: adjustHistoryArray(prev.cpu, historyLength),
      memory: adjustHistoryArray(prev.memory, historyLength),
      gpu: adjustHistoryArray(prev.gpu, historyLength),
      netUp: adjustHistoryArray(prev.netUp, historyLength),
      netDown: adjustHistoryArray(prev.netDown, historyLength),
      diskRead: adjustHistoryArray(prev.diskRead, historyLength),
      diskWrite: adjustHistoryArray(prev.diskWrite, historyLength)
    }));
    setGpuHistory(prev => prev.map(history => adjustHistoryArray(history, historyLength)));
  }, [historyLength, settingsLoaded]);

  // 獲取真實系統數據
  const fetchSystemData = async () => {
    if (!isElectron || !window.electronAPI) {
      console.log('Not in Electron environment, using mock data');
      return;
    }

    try {
      // 並行獲取所有系統信息
      const [sysInfo, cpuLoadData, gpuLoadData, ioStats] = await Promise.all([
        window.electronAPI.getSystemInfo(),
        window.electronAPI.getCpuLoad(),
        window.electronAPI.getGpuLoad(),
        window.electronAPI.getIoStats()
      ]);

      if (sysInfo) {
        setSystemInfo(sysInfo);

        // 處理進程數據
        const totalMemoryBytes = sysInfo.memory?.total || 16000000000;
        const totalMemoryMb = totalMemoryBytes / 1024 / 1024;

        const processData = sysInfo.processes.map((proc, index) => {
          const cpuCandidates = [proc.pcpu, proc.cpu, proc.cpuPercent];
          const resolvedCpu = cpuCandidates
            .map(value => (typeof value === 'number' ? value : Number(value)))
            .find(value => Number.isFinite(value)) || 0;

          const rawPercent = typeof proc.pmem === 'number' ? proc.pmem : Number(proc.pmem) || 0;
          const rawMemRss = typeof proc.memRss === 'number' ? proc.memRss : Number(proc.memRss) || 0;
          const rawMemVsz = typeof proc.memVsz === 'number' ? proc.memVsz : Number(proc.memVsz) || 0;

          const memoryMbFromPercent = rawPercent > 0
            ? (rawPercent * totalMemoryBytes) / 100 / 1024 / 1024
            : 0;
          const memoryMbFromRss = rawMemRss > 0 ? rawMemRss / 1024 / 1024 : 0;
          const memoryMbFromVsz = rawMemVsz > 0 ? rawMemVsz / 1024 / 1024 : 0;

          const memoryMb = [memoryMbFromPercent, memoryMbFromRss, memoryMbFromVsz]
            .find(value => Number.isFinite(value) && value > 0) || 0;

          const memoryPercentCandidate = memoryMb > 0 && totalMemoryMb > 0
            ? (memoryMb / totalMemoryMb) * 100
            : rawPercent;
          const memoryPercent = Number.isFinite(memoryPercentCandidate)
            ? memoryPercentCandidate
            : 0;

          return {
            id: proc.pid || index,
            name: proc.name || proc.command || 'Unknown',
            cpu: resolvedCpu,
            memory: memoryMb,
            pid: proc.pid || 0,
            status: proc.state === 'running' ? 'Running' : proc.state || 'Unknown',
            user: proc.user || 'unknown',
            threads: proc.threads || 1,
            handles: proc.handles || 0,
            parentPid: proc.parentPid || proc.ppid || null,
            priority: proc.priority || null,
            command: proc.command || '',
            path: proc.path || '',
            params: Array.isArray(proc.params) ? proc.params.join(' ') : (proc.params || ''),
            started: proc.started || '',
            cpuRaw: resolvedCpu,
            memoryRaw: memoryPercent
          };
        });

        setProcesses(processData);

        if (Array.isArray(sysInfo.fsSize) && sysInfo.fsSize.length > 0) {
          setStorageDevices(sysInfo.fsSize);
        }
      }

      if (cpuLoadData) {
        const resolveLoadValue = (...values) => values
          .map(value => (typeof value === 'number' ? value : Number(value)))
          .find(value => Number.isFinite(value));

        const normalizedCores = Array.isArray(cpuLoadData.cores)
          ? cpuLoadData.cores.map(core => {
              const resolvedLoad = resolveLoadValue(
                core.load,
                core.loadCombined,
                core.currentLoad
              ) || 0;
              const resolvedUserLoad = resolveLoadValue(
                core.loadUser,
                core.user,
                core.currentLoadUser
              ) || 0;
              const resolvedSystemLoad = resolveLoadValue(
                core.loadSystem,
                core.system,
                core.currentLoadSystem
              ) || 0;

              return {
                ...core,
                load: resolvedLoad,
                userLoad: resolvedUserLoad,
                systemLoad: resolvedSystemLoad
              };
            })
          : [];

        const averageFromCores = (key) => normalizedCores.length
          ? normalizedCores.reduce((sum, core) => sum + (core[key] || 0), 0) / normalizedCores.length
          : 0;

        const normalizedOverall = resolveLoadValue(
          cpuLoadData.overall,
          cpuLoadData.currentLoad,
          cpuLoadData.currentload
        );
        const normalizedUserTop = resolveLoadValue(
          cpuLoadData.user,
          cpuLoadData.currentLoadUser,
          cpuLoadData.currentload_user
        );
        const normalizedSystemTop = resolveLoadValue(
          cpuLoadData.system,
          cpuLoadData.currentLoadSystem,
          cpuLoadData.currentload_system
        );

        const normalizedOverallFinal = Number.isFinite(normalizedOverall)
          ? normalizedOverall
          : averageFromCores('load');
        const normalizedUserFinal = Number.isFinite(normalizedUserTop)
          ? normalizedUserTop
          : averageFromCores('userLoad');
        const normalizedSystemFinal = Number.isFinite(normalizedSystemTop)
          ? normalizedSystemTop
          : averageFromCores('systemLoad');

        setCpuLoad({
          overall: normalizedOverallFinal || 0,
          user: normalizedUserFinal || 0,
          system: normalizedSystemFinal || 0,
          cores: normalizedCores
        });
        
        // 更新性能歷史
        const primaryGpuUsage = gpuLoadData && gpuLoadData[0]
          ? Number.isFinite(gpuLoadData[0].utilizationGpu) ? gpuLoadData[0].utilizationGpu : 0
          : 0;

        setPerformanceHistory(prev => ({
          ...prev,
          cpu: appendHistory(prev.cpu, normalizedOverallFinal || 0),
          memory: appendHistory(prev.memory, sysInfo?.memory ? (sysInfo.memory.used / sysInfo.memory.total * 100) : 0),
          gpu: appendHistory(prev.gpu, primaryGpuUsage)
        }));
      }

      if (gpuLoadData && gpuLoadData.length > 0) {
        setGpuLoad(gpuLoadData);
        setGpuHistory(prev => {
          return gpuLoadData.map((gpu, index) => {
            const utilization = Number.isFinite(gpu?.utilizationGpu) ? gpu.utilizationGpu : 0;
            const history = prev[index] || createHistoryArray(historyLength);
            return appendHistory(history, utilization);
          });
        });

        setSelectedGpuIndex(index => {
          if (index >= gpuLoadData.length) {
            return 0;
          }
          return index;
        });
      }

      if (ioStats) {
        const networkArray = Array.isArray(ioStats.network) ? ioStats.network : [];
        const ifaceList = Array.isArray(ioStats.networkInterfaces) ? ioStats.networkInterfaces : [];
        const fsData = ioStats.fsStats || null;
        const diskData = ioStats.disks || null;
        const fsSizeData = Array.isArray(ioStats.fsSize) ? ioStats.fsSize : [];

        setNetworkStats(networkArray);
        setNetworkInterfaces(ifaceList);
        setFsStats(fsData);
        setDiskStats(diskData);
        setStorageDevices(prevDevices => {
          if (fsSizeData.length > 0) {
            return fsSizeData;
          }
          if (Array.isArray(sysInfo?.fsSize) && sysInfo.fsSize.length > 0) {
            return sysInfo.fsSize;
          }
          return prevDevices;
        });

        const aggregatedNetwork = networkArray.reduce((acc, iface) => {
          const rx = Number(iface?.rx_sec) || 0;
          const tx = Number(iface?.tx_sec) || 0;
          return {
            rx: acc.rx + rx,
            tx: acc.tx + tx
          };
        }, { rx: 0, tx: 0 });

        const netDownMbps = aggregatedNetwork.rx / 1024 / 1024;
        const netUpMbps = aggregatedNetwork.tx / 1024 / 1024;

        const diskReadMB = fsData && Number.isFinite(fsData.rx_sec) ? fsData.rx_sec / 1024 / 1024 : 0;
        const diskWriteMB = fsData && Number.isFinite(fsData.wx_sec) ? fsData.wx_sec / 1024 / 1024 : 0;

        setPerformanceHistory(prev => ({
          ...prev,
          netUp: appendHistory(prev.netUp, netUpMbps),
          netDown: appendHistory(prev.netDown, netDownMbps),
          diskRead: appendHistory(prev.diskRead, diskReadMB),
          diskWrite: appendHistory(prev.diskWrite, diskWriteMB)
        }));
      }

    } catch (error) {
      console.error('Error fetching system data:', error);
    }
  };

  // 定時更新數據
  useEffect(() => {
    if (!isElectron) {
      return undefined;
    }

    let cancelled = false;

    const runFetch = () => {
      if (cancelled) return;
      fetchSystemData();
      setCurrentTime(new Date());
    };

    runFetch();

    const interval = setInterval(runFetch, updateInterval); // 依設定更新

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isElectron, updateInterval, historyLength]);

  // 結束處理程序
  const handleKillProcess = async (pid, signal = 'SIGTERM') => {
    if (!isElectron || !window.electronAPI) {
      alert('此功能僅在桌面應用中可用');
      return;
    }

    const actionLabel = signal === 'SIGKILL' ? 'FORCE TERMINATE' : 'TERMINATE';
    if (window.confirm(`> ${actionLabel} PROCESS ${pid}? [Y/N]`)) {
      try {
        const result = await window.electronAPI.killProcess(pid, signal);
        if (result.success) {
          // 刷新進程列表
          fetchSystemData();
          if (selectedPid === pid) {
            setSelectedPid(null);
          }
        } else {
          alert(`無法結束處理程序: ${result.error}`);
        }
      } catch (error) {
        console.error('Error killing process:', error);
        alert('結束處理程序時發生錯誤');
      }
    }
  };
  const filteredProcesses = processes
    .filter(process => 
      process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      process.pid.toString().includes(searchTerm)
    )
    .sort((a, b) => {
      const modifier = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') {
        return modifier * a.name.localeCompare(b.name);
      }
      return modifier * (a[sortBy] - b[sortBy]);
    });

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatMemory = (mb) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  const formatUptime = (seconds) => {
    if (seconds === undefined || seconds === null) {
      return '0h 0m';
    }
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getCpuBarColor = (usage) => {
    if (usage > 80) return 'bg-red-400';
    if (usage > 60) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  const getMatrixChar = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    return chars[Math.floor(Math.random() * chars.length)];
  };

  const generateMatrixBlock = (rows, columns) =>
    Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => getMatrixChar()).join('')
    ).join('\n');

  const formatThroughput = (mbps) => {
    if (!Number.isFinite(mbps) || mbps <= 0) return '0.0 MB/s';
    if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
    return `${(mbps * 1024).toFixed(0)} KB/s`;
  };

  const formatIops = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '0 IOPS';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k IOPS`;
    return `${Math.round(value)} IOPS`;
  };

  const formatStorage = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 GB';
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(1)} GB`;
  };

  const interfaceLabelMap = useMemo(() => {
    const map = {};
    networkInterfaces.forEach(iface => {
      if (!iface) return;
      const base = iface.ifaceName || iface.iface || iface.type || 'Unknown';
      const ip = iface.ip4 || iface.ip6;
      map[iface.iface] = ip ? `${base} (${ip})` : base;
    });
    return map;
  }, [networkInterfaces]);

  const networkSummary = useMemo(() => {
    if (!Array.isArray(networkStats) || networkStats.length === 0) {
      return { up: 0, down: 0, top: [] };
    }

    const candidates = networkStats.map(iface => {
      const up = Number(iface?.tx_sec) / 1024 / 1024 || 0;
      const down = Number(iface?.rx_sec) / 1024 / 1024 || 0;
      const total = up + down;
      return {
        name: interfaceLabelMap[iface.iface] || iface.iface || 'Unknown',
        up,
        down,
        total
      };
    });

    const totals = candidates.reduce((acc, item) => ({
      up: acc.up + item.up,
      down: acc.down + item.down
    }), { up: 0, down: 0 });

    const top = candidates
      .filter(item => item.total > 0.001)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    return {
      up: totals.up,
      down: totals.down,
      top
    };
  }, [networkStats, interfaceLabelMap]);

  const diskSummary = useMemo(() => {
    const fsReadSec = fsStats ? Number(fsStats.rx_sec) : NaN;
    const fsWriteSec = fsStats ? Number(fsStats.wx_sec) : NaN;

    const aggregatedDiskStats = Array.isArray(diskStats)
      ? diskStats.reduce((acc, item) => ({
          rIO_sec: acc.rIO_sec + (Number(item?.rIO_sec) || 0),
          wIO_sec: acc.wIO_sec + (Number(item?.wIO_sec) || 0)
        }), { rIO_sec: 0, wIO_sec: 0 })
      : diskStats || { rIO_sec: 0, wIO_sec: 0 };

    const diskReadIopsValue = Number(aggregatedDiskStats.rIO_sec);
    const diskWriteIopsValue = Number(aggregatedDiskStats.wIO_sec);

    const readMB = Number.isFinite(fsReadSec) ? fsReadSec / 1024 / 1024 : 0;
    const writeMB = Number.isFinite(fsWriteSec) ? fsWriteSec / 1024 / 1024 : 0;
    const readIops = Number.isFinite(diskReadIopsValue) ? diskReadIopsValue : 0;
    const writeIops = Number.isFinite(diskWriteIopsValue) ? diskWriteIopsValue : 0;

    return {
      readMB,
      writeMB,
      readIops,
      writeIops
    };
  }, [fsStats, diskStats]);

  const storageSummary = useMemo(() => {
    if (!Array.isArray(storageDevices) || storageDevices.length === 0) {
      return [];
    }

    const visibleVolumes = ['/', '/System/Volumes/Data'];

    const deduped = new Map();

    storageDevices.forEach(device => {
      if (!device) return;

      const mount = device.mount || device.fs || '';
      if (!mount) return;

      const isVisible =
        visibleVolumes.includes(mount) ||
        mount.startsWith('/Volumes') ||
        mount === '/System/Volumes/Data';

      if (!isVisible) {
        return;
      }

      const key = mount.toLowerCase();
      const current = deduped.get(key);

      if (!current || (Number(device.size) || 0) > (Number(current.size) || 0)) {
        deduped.set(key, device);
      }
    });

    const namingOverrides = (mountPath, device) => {
      if (mountPath === '/') return 'System Root (/)';
      if (mountPath === '/System/Volumes/Data') return 'System Data';
      if (mountPath.startsWith('/Volumes/')) {
        return mountPath.replace('/Volumes/', '');
      }
      return device.label || device.fs || mountPath || 'Unknown';
    };

    return Array.from(deduped.values())
      .map(device => {
        const sizeBytes = Number(device?.size) || 0;
        const usedBytes = Number(device?.used) || 0;
        const availableBytes = Number(device?.available) || (sizeBytes - usedBytes);
        const usagePercent = sizeBytes > 0 ? (usedBytes / sizeBytes) * 100 : 0;
        const mount = device.mount || device.fs || 'Unknown';

        return {
          name: namingOverrides(mount, device),
          mount,
          sizeBytes,
          usedBytes,
          availableBytes,
          usagePercent: Number.isFinite(usagePercent) ? usagePercent : 0
        };
      })
      .sort((a, b) => b.sizeBytes - a.sizeBytes);
  }, [storageDevices]);

  const netDownMax = Math.max(...performanceHistory.netDown, 0.001);
  const netUpMax = Math.max(...performanceHistory.netUp, 0.001);
  const diskReadMax = Math.max(...performanceHistory.diskRead, 0.001);
  const diskWriteMax = Math.max(...performanceHistory.diskWrite, 0.001);
  const activeGpu = gpuLoad[selectedGpuIndex] || gpuLoad[0] || null;
  const activeGpuHistory = gpuHistory[selectedGpuIndex] || gpuHistory[0] || createHistoryArray(historyLength);
  const gpuHistoryMax = Math.max(...activeGpuHistory, 1);
  const gpuMemoryUsed = Number.isFinite(activeGpu?.memoryUsed) ? activeGpu.memoryUsed : 0;
  const gpuMemoryTotal = Number.isFinite(activeGpu?.memoryTotal) ? activeGpu.memoryTotal : 0;
  const gpuMemoryUsage = gpuMemoryTotal > 0 ? (gpuMemoryUsed / gpuMemoryTotal) * 100 : 0;
  const openSettings = () => {
    setPendingSettings({
      ...settings,
      enabledCards: {
        ...settings.enabledCards,
        cpu: true
      }
    });
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  const updatePendingField = (field, value) => {
    setPendingSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCardToggle = (cardId, checked) => {
    if (cardId === 'cpu') return;

    setPendingSettings(prev => {
      const nextEnabled = {
        ...prev.enabledCards,
        cpu: true,
        [cardId]: checked
      };

      let nextDefault = prev.defaultPerformanceTab;
      if (!nextEnabled[nextDefault]) {
        const fallback = PERFORMANCE_TABS.find(tab => nextEnabled[tab.id]);
        nextDefault = fallback ? fallback.id : 'cpu';
      }

      return {
        ...prev,
        enabledCards: nextEnabled,
        defaultPerformanceTab: nextDefault
      };
    });
  };

  const handleSettingsSubmit = (event) => {
    event.preventDefault();

    const normalizedInterval = Math.max(
      MIN_UPDATE_INTERVAL,
      Number(pendingSettings.updateInterval) || defaultSettings.updateInterval
    );

    const normalizedHistory = Math.min(
      MAX_HISTORY_LENGTH,
      Math.max(
        MIN_HISTORY_LENGTH,
        Math.round(Number(pendingSettings.historyLength) || defaultSettings.historyLength)
      )
    );

    const enabledCards = {
      ...defaultSettings.enabledCards,
      ...(pendingSettings.enabledCards || {}),
      cpu: true
    };

    const nextSettings = {
      ...pendingSettings,
      updateInterval: normalizedInterval,
      historyLength: normalizedHistory,
      enabledCards
    };

    const futureAvailableTabs = PERFORMANCE_TABS.filter(tab => {
      if (!enabledCards[tab.id]) return false;
      if (tab.requireGpu && gpuLoad.length === 0) return false;
      return true;
    });

    if (!futureAvailableTabs.some(tab => tab.id === nextSettings.defaultPerformanceTab)) {
      nextSettings.defaultPerformanceTab = futureAvailableTabs.length > 0 ? futureAvailableTabs[0].id : 'cpu';
    }

    setSettings(nextSettings);
    setPerformanceTab(nextSettings.defaultPerformanceTab);
    setIsSettingsOpen(false);
  };

  const selectedProcess = useMemo(() => {
    if (!selectedPid) return null;
    return processes.find(proc => proc.pid === selectedPid) || null;
  }, [processes, selectedPid]);

  const handleCopy = async (label, value) => {
    if (!value) {
      alert(`${label} 無可用資料`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      alert(`${label} 已複製到剪貼簿`);
    } catch (error) {
      console.error('Clipboard write failed:', error);
      alert('無法複製到剪貼簿');
    }
  };

  const helperFns = { formatThroughput, formatIops, formatMemory, formatStorage, getCpuBarColor };
  const processHelpers = { formatMemory, formatNumber, formatUptime, getCpuBarColor, handleCopy };

  const performanceMatrixText = useMemo(() => generateMatrixBlock(20, 100), [performanceTab]);
  const processMatrixText = useMemo(() => generateMatrixBlock(8, 120), [filteredProcesses.length, selectedPid]);

  const settingsElement = (
    <SettingsModal
      isOpen={isSettingsOpen}
      pendingSettings={pendingSettings}
      onClose={closeSettings}
      onSubmit={handleSettingsSubmit}
      onUpdateField={updatePendingField}
      onCardToggle={handleCardToggle}
      tabs={PERFORMANCE_TABS}
      minUpdateInterval={MIN_UPDATE_INTERVAL}
      minHistory={MIN_HISTORY_LENGTH}
      maxHistory={MAX_HISTORY_LENGTH}
    />
  );

  // 如果不在Electron環境中，顯示警告
  if (!isElectron) {
    return (
      <div className="w-full max-w-4xl mx-auto bg-black text-red-400 rounded-lg shadow-2xl border border-red-500/30 font-mono p-8">
        <div className="flex items-center space-x-4 mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold">[WARNING] BROWSER_MODE_DETECTED</h1>
            <p className="text-red-300">此應用需要在Electron桌面環境中運行才能獲取真實系統數據</p>
          </div>
        </div>
        
        <div className="bg-gray-900/50 p-4 rounded border border-red-500/20 mb-6">
          <h2 className="text-lg font-bold text-red-400 mb-3">[SETUP_INSTRUCTIONS]</h2>
          <div className="space-y-2 text-sm text-red-300">
            <p>1. 安裝完成所有文件</p>
            <p>2. 運行開發模式: npm run electron:dev</p>
            <p>3. 或運行網頁模式: npm run dev</p>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-red-300">當前顯示的是演示UI，無法執行實際系統監控功能</p>
        </div>
      </div>
    );
  }

  // 計算系統統計
  const systemStats = {
    totalCpu: cpuLoad?.overall || 0,
    totalMemory: systemInfo?.memory?.total / 1024 / 1024 || 16384,
    usedMemory: systemInfo?.memory?.used / 1024 / 1024 || 0,
    availableMemory: (systemInfo?.memory?.available || systemInfo?.memory?.free || 0) / 1024 / 1024,
    processes: processes.length,
    threads: processes.reduce((sum, p) => sum + (p.threads || 0), 0),
    handles: processes.reduce((sum, p) => sum + (p.handles || 0), 0),
    uptime: formatUptime(systemInfo?.time?.uptime),
    cpuUser: cpuLoad?.user || 0,
    cpuSystem: cpuLoad?.system || 0,
    cpuTemp: Math.round(systemInfo?.temperature?.main || 45),
    cpuPower: (cpuLoad?.overall || 0) / 100 * 15 + 5,
    gpuUsage: Number.isFinite(activeGpu?.utilizationGpu) ? activeGpu.utilizationGpu : 0,
    gpuMemory: Number.isFinite(activeGpu?.memoryUsed) ? activeGpu.memoryUsed : 0,
    gpuMemoryTotal: Number.isFinite(activeGpu?.memoryTotal) ? activeGpu.memoryTotal : 0,
    gpuTemp: Math.round(activeGpu?.temperatureGpu || 40),
    gpuPower: (Number.isFinite(activeGpu?.utilizationGpu) ? activeGpu.utilizationGpu : 0) / 100 * 25 + 8,
    gpuCount: gpuLoad.length,
    gpuModel: activeGpu?.model || 'INTEGRATED',
    networkUp: networkSummary.up,
    networkDown: networkSummary.down,
    networkTop: networkSummary.top,
    diskRead: diskSummary.readMB,
    diskWrite: diskSummary.writeMB,
    diskReadIops: diskSummary.readIops,
    diskWriteIops: diskSummary.writeIops,
    storageVolumes: storageSummary,
    totalPower: 0,
    batteryLevel: systemInfo?.battery?.percent || 100
  };

  systemStats.totalPower = systemStats.cpuPower + systemStats.gpuPower + 5;

  const performancePanelData = {
    cpu: { systemInfo, systemStats, cpuLoad, performanceHistory },
    gpu: {
      systemStats,
      gpuLoad,
      selectedGpuIndex,
      onSelectGpu: setSelectedGpuIndex,
      activeGpuHistory,
      gpuHistoryMax,
      gpuMemoryUsage
    },
    network: {
      systemStats,
      performanceHistory,
      netDownMax,
      netUpMax,
      interfacesCount: networkStats.length
    },
    storage: {
      systemStats,
      performanceHistory,
      diskReadMax,
      diskWriteMax
    }
  };

  const performancePanelProps = {
    tabs: tabsForRender,
    activeTab: performanceTab,
    onTabChange: setPerformanceTab,
    isMobile,
    data: performancePanelData,
    helpers: helperFns
  };

  // 渲染效能頁面
  if (selectedTab === 'performance') {
    return (
      <>
        <PerformanceView
          matrixText={performanceMatrixText}
          currentTime={currentTime}
          onNavigateProcesses={() => setSelectedTab('processes')}
          onOpenSettings={openSettings}
          panelProps={performancePanelProps}
        />
        {settingsElement}
      </>
    );
  }

  return (
    <>
      <ProcessView
        matrixText={processMatrixText}
        currentTime={currentTime}
        systemStats={systemStats}
        isMobile={isMobile}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        filteredProcesses={filteredProcesses}
        selectedProcess={selectedProcess}
        onSelectProcess={setSelectedPid}
        onKillProcess={handleKillProcess}
        onOpenSettings={openSettings}
        onNavigatePerformance={() => setSelectedTab('performance')}
        helpers={processHelpers}
      />
      <StatusBar
        isMobile={isMobile}
        systemStats={systemStats}
        updateInterval={updateInterval}
        currentTime={currentTime}
        filteredCount={filteredProcesses.length}
        totalCount={processes.length}
      />
      {settingsElement}
    </>
  );
};

export default TaskManager;
