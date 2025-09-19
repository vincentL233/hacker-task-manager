import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Terminal, Zap, Activity, AlertTriangle, Settings } from 'lucide-react';

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
  const performanceTabs = tabsForRender;

  const renderPerformanceCard = () => {
    switch (performanceTab) {
      case 'gpu':
        return (
          <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-base md:text-lg font-bold text-green-400 flex items-center space-x-2">
                <Activity className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                <span className="text-sm md:text-base">[GPU] {systemStats.gpuModel}</span>
              </h3>
              {systemStats.gpuCount > 1 && (
                <div className="flex space-x-1 text-[10px] md:text-xs">
                  {gpuLoad.map((gpu, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedGpuIndex(index)}
                      className={`px-2 py-1 border rounded transition-colors ${index === selectedGpuIndex ? 'bg-green-500/30 border-green-400 text-green-200' : 'border-green-500/40 text-green-300 hover:bg-green-500/10'}`}
                    >
                      GPU_{index}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                <div>USAGE: <span className="text-green-300 font-bold">{systemStats.gpuUsage.toFixed(1)}%</span></div>
                <div>POWER: <span className="text-green-300 font-bold">{systemStats.gpuPower.toFixed(1)}W</span></div>
                <div>MEM: <span className="text-green-300 font-bold">{formatMemory(systemStats.gpuMemory)}{systemStats.gpuMemoryTotal > 0 ? ` / ${formatMemory(systemStats.gpuMemoryTotal)}` : ''}</span></div>
                <div>TEMP: <span className="text-green-300 font-bold">{systemStats.gpuTemp}°C</span></div>
              </div>
              {systemStats.gpuMemoryTotal > 0 && (
                <div className="mt-3">
                  <div className="h-2 md:h-3 bg-gray-800 rounded-sm overflow-hidden border border-green-500/30">
                    <div
                      className="h-full bg-green-400 transition-all duration-300"
                      style={{ width: `${Math.min(gpuMemoryUsage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-green-300 mt-1 text-right">
                    VRAM: {gpuMemoryUsage.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold mb-2 md:mb-3 text-green-400 text-xs md:text-sm">[GPU_HISTORY]</h4>
              <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                {activeGpuHistory.slice(isMobile ? -20 : -30).map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-green-400 rounded-sm min-h-0.5"
                    style={{ height: `${Math.min((value / gpuHistoryMax) * 100, 100)}%` }}
                  ></div>
                ))}
              </div>
              <div className="text-[10px] text-green-300 mt-1">
                最近負載趨勢（取樣 {isMobile ? 20 : 30} 次）
              </div>
            </div>

            {(!activeGpu || !Number.isFinite(activeGpu.utilizationGpu)) && (
              <p className="text-[10px] text-green-300/80">
                * GPU 利用率由系統回報。若無法取得，將顯示推估或保持 0。
              </p>
            )}
          </div>
        );

      case 'network':
        return (
          <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
            <h3 className="text-base md:text-lg font-bold text-green-400">[NETWORK] THROUGHPUT</h3>
            <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                <div>DOWN: <span className="text-green-300 font-bold">{formatThroughput(systemStats.networkDown)}</span></div>
                <div>UP: <span className="text-green-300 font-bold">{formatThroughput(systemStats.networkUp)}</span></div>
                <div>INTERFACES: <span className="text-green-300 font-bold">{networkStats.length}</span></div>
                <div>TOP: <span className="text-green-300 font-bold">{systemStats.networkTop[0]?.name || 'N/A'}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-green-300 mb-1">DOWN</div>
                <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                  {performanceHistory.netDown.slice(isMobile ? -20 : -30).map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-blue-400 rounded-sm min-h-0.5"
                      style={{ height: `${Math.min((value / netDownMax) * 100, 100)}%` }}
                    ></div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-300 mb-1">UP</div>
                <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                  {performanceHistory.netUp.slice(isMobile ? -20 : -30).map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-purple-400 rounded-sm min-h-0.5"
                      style={{ height: `${Math.min((value / netUpMax) * 100, 100)}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-green-400 text-xs md:text-sm">[TOP_INTERFACES]</h4>
              {systemStats.networkTop.length > 0 ? (
                systemStats.networkTop.map((iface, index) => (
                  <div key={index} className="flex justify-between items-center bg-gray-900/60 border border-green-500/20 rounded px-2 py-1">
                    <span className="text-green-200 truncate pr-2">{iface.name}</span>
                    <span className="text-green-300 font-mono">{formatThroughput(iface.down)} / {formatThroughput(iface.up)}</span>
                  </div>
                ))
              ) : (
                <div className="text-green-300">No active interfaces</div>
              )}
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
            <h3 className="text-base md:text-lg font-bold text-green-400">[STORAGE] PERFORMANCE</h3>
            <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
              <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                <div>READ: <span className="text-green-300 font-bold">{formatThroughput(systemStats.diskRead)}</span></div>
                <div>WRITE: <span className="text-green-300 font-bold">{formatThroughput(systemStats.diskWrite)}</span></div>
                <div>READ IOPS: <span className="text-green-300 font-bold">{formatIops(systemStats.diskReadIops)}</span></div>
                <div>WRITE IOPS: <span className="text-green-300 font-bold">{formatIops(systemStats.diskWriteIops)}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-green-300 mb-1">READ</div>
                <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                  {performanceHistory.diskRead.slice(isMobile ? -20 : -30).map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-teal-400 rounded-sm min-h-0.5"
                      style={{ height: `${Math.min((value / diskReadMax) * 100, 100)}%` }}
                    ></div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-300 mb-1">WRITE</div>
                <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                  {performanceHistory.diskWrite.slice(isMobile ? -20 : -30).map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-amber-400 rounded-sm min-h-0.5"
                      style={{ height: `${Math.min((value / diskWriteMax) * 100, 100)}%` }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2 md:mb-3 text-green-400 text-xs md:text-sm">[VOLUME_USAGE]</h4>
              <div className="space-y-1 text-xs">
                {systemStats.storageVolumes.length > 0 ? (
                  systemStats.storageVolumes.slice(0, 5).map((volume, index) => (
                    <div key={index} className="bg-gray-900/60 border border-green-500/20 rounded px-2 py-2">
                      <div className="flex justify-between text-green-200">
                        <span className="truncate pr-2">{volume.name}</span>
                        <span className="font-mono">{volume.usagePercent.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-sm overflow-hidden border border-green-500/30 mt-1">
                        <div
                          className="h-full bg-green-400"
                          style={{ width: `${Math.min(volume.usagePercent, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-green-300 mt-1 font-mono">
                        <span>USED: {formatStorage(volume.usedBytes)}</span>
                        <span>FREE: {formatStorage(volume.availableBytes)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-green-300">No volume information</div>
                )}
              </div>
              <p className="text-[10px] text-green-300/80 mt-2">
                * 數據為系統層級總計，部分平台可能無法取得外接磁碟 I/O，僅顯示已知容量資訊。
              </p>
            </div>
          </div>
        );

      case 'cpu':
      default:
        return (
          <div className="space-y-4">
            <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
              <h3 className="text-base md:text-lg font-bold text-green-400 flex items-center space-x-2">
                <Zap className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                <span className="text-sm md:text-base">[CPU_CORE] {systemInfo?.cpu?.manufacturer} {systemInfo?.cpu?.brand}</span>
              </h3>
              <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
                <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                  <div>USAGE: <span className="text-green-300 font-bold">{systemStats.totalCpu.toFixed(1)}%</span></div>
                  <div>USER/SYS: <span className="text-green-300 font-bold">{systemStats.cpuUser.toFixed(1)}% / {systemStats.cpuSystem.toFixed(1)}%</span></div>
                  <div>CORES: <span className="text-green-300 font-bold">{systemInfo?.cpu?.cores || 'N/A'}</span></div>
                  <div>THREADS: <span className="text-green-300 font-bold">{systemInfo?.cpu?.processors || 'N/A'}</span></div>
                  <div>TEMP: <span className="text-green-300 font-bold">{systemStats.cpuTemp}°C</span></div>
                  <div>UPTIME: <span className="text-green-300 font-bold">{formatUptime(systemInfo?.time?.uptime)}</span></div>
                </div>
              </div>

              {cpuLoad && cpuLoad.cores && (
                <div>
                  <h4 className="font-bold mb-2 md:mb-3 text-green-400 text-xs md:text-sm">[CPU_CORES] LOAD</h4>
                  <div className="space-y-1">
                    {cpuLoad.cores.slice(0, isMobile ? 6 : cpuLoad.cores.length).map((core, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-xs w-14 md:w-20 text-green-300">CORE_{index}</span>
                        <div className="flex-1 h-2 md:h-3 bg-gray-800 rounded-sm overflow-hidden border border-green-500/30">
                          <div
                            className={`h-full transition-all duration-300 ${getCpuBarColor(core.load)} animate-pulse`}
                            style={{ width: `${core.load}%` }}
                          ></div>
                        </div>
                        <span className="text-xs w-8 md:w-12 text-green-300 font-bold">{core.load.toFixed(0)}%</span>
                      </div>
                    ))}
                    {isMobile && cpuLoad.cores.length > 6 && (
                      <div className="text-xs text-green-300 text-center">...+{cpuLoad.cores.length - 6} cores</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
                <h3 className="text-base md:text-lg font-bold text-green-400">[MEMORY_STATUS]</h3>
                <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>USED:</span>
                      <span className="text-green-300 font-bold">{formatMemory(systemStats.usedMemory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>FREE:</span>
                      <span className="text-green-300 font-bold">{formatMemory(systemStats.availableMemory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TOTAL:</span>
                      <span className="text-green-300 font-bold">{formatMemory(systemStats.totalMemory)}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-3 md:h-4 bg-gray-800 rounded-sm overflow-hidden border border-green-500/30">
                      <div
                        className="h-full bg-green-400 transition-all duration-300 animate-pulse"
                        style={{ width: `${(systemStats.usedMemory / systemStats.totalMemory) * 100}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-green-300 mt-1 text-center">
                      USAGE: {((systemStats.usedMemory / systemStats.totalMemory) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
                <h3 className="text-base md:text-lg font-bold text-green-400">[POWER_STATUS]</h3>
                <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>CPU_PWR:</span>
                      <span className="text-green-300 font-bold">{systemStats.cpuPower.toFixed(1)}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPU_PWR:</span>
                      <span className="text-green-300 font-bold">{systemStats.gpuPower.toFixed(1)}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TOTAL:</span>
                      <span className="text-green-300 font-bold">{systemStats.totalPower.toFixed(1)}W</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BATTERY:</span>
                      <span className={`font-bold ${systemStats.batteryLevel > 20 ? 'text-green-300' : 'text-red-400'}`}>
                        {systemStats.batteryLevel.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold mb-2 md:mb-3 text-green-400 text-xs md:text-sm">[PERF_HISTORY]</h4>
                  <div className="space-y-2 md:space-y-3">
                    <div>
                      <div className="text-xs text-green-300 mb-1">CPU</div>
                      <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                        {performanceHistory.cpu.slice(isMobile ? -20 : -30).map((value, index) => (
                          <div
                            key={index}
                            className="flex-1 bg-green-400 rounded-sm min-h-0.5"
                            style={{ height: `${(value / 100) * 100}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-green-300 mb-1">MEM</div>
                      <div className="h-6 md:h-8 bg-gray-800 rounded-sm flex items-end space-x-0.5 px-1 border border-green-500/30">
                        {performanceHistory.memory.slice(isMobile ? -20 : -30).map((value, index) => (
                          <div
                            key={index}
                            className="flex-1 bg-blue-400 rounded-sm min-h-0.5"
                            style={{ height: `${(value / 100) * 100}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

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

  const handleCardToggle = (cardId, checked) => {
    if (cardId === 'cpu') {
      return;
    }

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

  const renderSettingsModal = () => {
    if (!isSettingsOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-xl bg-gray-950 border border-green-500/40 rounded-lg shadow-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-green-200">[SETTINGS_PANEL]</h2>
            <button
              onClick={closeSettings}
              className="text-green-300 hover:text-green-100"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-5 text-xs md:text-sm text-green-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-2">
                <span className="block uppercase tracking-wide text-green-300">更新頻率 (毫秒)</span>
                <input
                  type="number"
                  min={MIN_UPDATE_INTERVAL}
                  step={100}
                  value={pendingSettings.updateInterval}
                  onChange={(e) => setPendingSettings(prev => ({ ...prev, updateInterval: Number(e.target.value) }))}
                  className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                />
                <span className="text-[10px] text-green-400/80">最小 {MIN_UPDATE_INTERVAL} ms</span>
              </label>

              <label className="space-y-2">
                <span className="block uppercase tracking-wide text-green-300">歷史長度 (取樣數)</span>
                <input
                  type="number"
                  min={MIN_HISTORY_LENGTH}
                  max={MAX_HISTORY_LENGTH}
                  step={10}
                  value={pendingSettings.historyLength}
                  onChange={(e) => setPendingSettings(prev => ({ ...prev, historyLength: Number(e.target.value) }))}
                  className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
                />
                <span className="text-[10px] text-green-400/80">{MIN_HISTORY_LENGTH}-{MAX_HISTORY_LENGTH} 取樣點</span>
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="block uppercase tracking-wide text-green-300">預設 Performance 卡片</span>
              <select
                value={pendingSettings.defaultPerformanceTab}
                onChange={(e) => setPendingSettings(prev => ({ ...prev, defaultPerformanceTab: e.target.value }))}
                className="w-full bg-black border border-green-500/40 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400"
              >
                {PERFORMANCE_TABS.map(tab => (
                  <option
                    key={tab.id}
                    value={tab.id}
                    disabled={pendingSettings.enabledCards?.[tab.id] === false}
                  >
                    {tab.label}{pendingSettings.enabledCards?.[tab.id] === false ? ' (關閉)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="block uppercase tracking-wide text-green-300">顯示的卡片</span>
              <div className="grid grid-cols-2 gap-2">
                {PERFORMANCE_TABS.map(tab => (
                  <label key={tab.id} className={`flex items-center space-x-2 bg-black/40 border border-green-500/30 rounded px-2 py-1 ${tab.id === 'cpu' ? 'opacity-80' : ''}`}>
                    <input
                      type="checkbox"
                      checked={pendingSettings.enabledCards?.[tab.id] !== false}
                      disabled={tab.id === 'cpu'}
                      onChange={(e) => handleCardToggle(tab.id, e.target.checked)}
                      className="accent-green-400"
                    />
                    <span>{tab.label}</span>
                  </label>
                ))}
              </div>
              <span className="text-[10px] text-green-400/80">CPU 卡片為必須顯示。</span>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={closeSettings}
                className="px-3 py-1 border border-green-500/40 text-green-300 rounded hover:bg-green-500/10"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-3 py-1 border border-green-500 text-green-100 bg-green-500/30 rounded hover:bg-green-500/40"
              >
                SAVE
              </button>
            </div>
          </form>
        </div>
      </div>
    );
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
  // 渲染效能頁面
  if (selectedTab === 'performance') {
    return (
      <div className="w-full max-w-7xl mx-auto bg-black text-green-400 rounded-lg shadow-2xl border border-green-500/30 font-mono">
        {/* Header */}
        <div className="bg-gray-900 p-3 md:p-4 border-b border-green-500/30 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="text-green-300 text-xs leading-3 whitespace-pre-wrap">
              {Array.from({length: 20}, () => Array.from({length: 100}, () => getMatrixChar()).join('')).join('\n')}
            </div>
          </div>
          <div className="relative flex flex-col md:flex-row justify-between md:items-center space-y-2 md:space-y-0">
            <div className="flex items-center space-x-2 md:space-x-3">
              <Terminal className="w-5 h-5 md:w-6 md:h-6 text-green-400 animate-pulse" />
              <div>
                <h1 className="text-base md:text-lg font-bold text-green-400">[SYSTEM_MONITOR.EXE]</h1>
                <div className="text-xs text-green-300">STATUS: ACTIVE | TIME: {currentTime.toLocaleTimeString()}</div>
              </div>
            </div>
          <div className="flex items-center space-x-2 md:space-x-3 text-xs">
            <button onClick={() => setSelectedTab('processes')} className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded">PROC</button>
            <button onClick={() => setSelectedTab('performance')} className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded">PERF</button>
            <button
              onClick={openSettings}
              className="px-2 md:px-3 py-1 border border-green-500/40 text-green-300 hover:bg-green-500/10 rounded flex items-center space-x-1"
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">SET</span>
            </button>
          </div>
        </div>
      </div>

        <div className="p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {performanceTabs.map(tab => (
              <button
                key={tab.id}
                disabled={tab.disabled}
                onClick={() => !tab.disabled && setPerformanceTab(tab.id)}
                className={`px-3 py-1 rounded border transition-colors ${performanceTab === tab.id ? 'bg-green-500/30 border-green-400 text-green-100' : tab.disabled ? 'border-green-500/10 text-green-500/40 cursor-not-allowed' : 'border-green-500/30 text-green-300 hover:bg-green-500/10'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {renderPerformanceCard()}
        </div>
        {renderSettingsModal()}
    </div>
  );
}
  // 渲染處理程序頁面
  return (
    <div className="w-full max-w-7xl mx-auto bg-black text-green-400 rounded-lg shadow-2xl border border-green-500/30 font-mono">
      {/* Header */}
      <div className="bg-gray-900 p-3 md:p-4 border-b border-green-500/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="text-green-300 text-xs leading-3 whitespace-pre-wrap">
            {Array.from({length: 8}, () => Array.from({length: 120}, () => getMatrixChar()).join('')).join('\n')}
          </div>
        </div>
        <div className="relative flex flex-col md:flex-row justify-between md:items-center space-y-2 md:space-y-0">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Terminal className="w-5 h-5 md:w-6 md:h-6 text-green-400 animate-pulse" />
            <div>
              <h1 className="text-base md:text-lg font-bold text-green-400">[PROCESS_MONITOR.EXE]</h1>
              <div className="text-xs text-green-300">STATUS: ACTIVE | TIME: {currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3 text-xs">
            <button onClick={() => setSelectedTab('processes')} className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded">PROC</button>
            <button onClick={() => setSelectedTab('performance')} className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded">PERF</button>
            <button
              onClick={openSettings}
              className="px-2 md:px-3 py-1 border border-green-500/40 text-green-300 hover:bg-green-500/10 rounded flex items-center space-x-1"
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">SET</span>
            </button>
          </div>
        </div>
      </div>

      {/* 系統統計 */}
      <div className="p-3 md:p-4 bg-gray-900/50 border-b border-green-500/30">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 md:gap-4 text-xs">
          <div className="text-center">
            <div className="text-green-300">PROCESSES</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.processes}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">CPU_USAGE</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.totalCpu.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">GPU_USAGE</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.gpuUsage.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">MEMORY</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{formatMemory(systemStats.usedMemory)}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">POWER</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.totalPower.toFixed(1)}W</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">BATTERY</div>
            <div className={`font-bold text-sm md:text-lg ${systemStats.batteryLevel > 20 ? 'text-green-400' : 'text-red-400'}`}>
              {systemStats.batteryLevel.toFixed(0)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-green-300">THREADS</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{formatNumber(systemStats.threads)}</div>
          </div>
          <div className="text-center">
            <div className="text-green-300">UPTIME</div>
            <div className="font-bold text-sm md:text-lg text-green-400">{systemStats.uptime}</div>
          </div>
        </div>
      </div>

      {/* 搜尋列 */}
      <div className="p-3 md:p-4 border-b border-green-500/30 bg-gray-900/30">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
          <input
            type="text"
            placeholder="> SEARCH_PROCESS_OR_PID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-green-500/50 rounded text-green-400 placeholder-green-600 focus:ring-2 focus:ring-green-400 focus:border-green-400 text-sm"
          />
        </div>
      </div>
      {/* 處理程序表格標題 */}
      <div className="bg-gray-900/50 px-3 md:px-4 py-3 border-b border-green-500/30">
        <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-green-300">
          <button onClick={() => handleSort('name')} className="col-span-3 text-left hover:text-green-400 transition-colors">
            [PROCESS_NAME] {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSort('pid')} className="col-span-1 text-center hover:text-green-400 transition-colors">
            [PID] {sortBy === 'pid' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div className="col-span-1 text-center">[STATUS]</div>
          <div className="col-span-1 text-center">[USER]</div>
          <button onClick={() => handleSort('cpu')} className="col-span-1 text-right hover:text-green-400 transition-colors">
            [CPU%] {sortBy === 'cpu' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSort('memory')} className="col-span-2 text-right hover:text-green-400 transition-colors">
            [MEMORY] {sortBy === 'memory' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSort('threads')} className="col-span-1 text-right hover:text-green-400 transition-colors">
            [THREADS] {sortBy === 'threads' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div className="col-span-1 text-center">[ACTION]</div>
        </div>
        
        {/* Mobile header */}
        <div className="md:hidden flex justify-between text-xs font-bold text-green-300">
          <button onClick={() => handleSort('name')} className="text-left hover:text-green-400">
            [PROCESS] {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSort('cpu')} className="text-right hover:text-green-400">
            [CPU%] {sortBy === 'cpu' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button onClick={() => handleSort('memory')} className="text-right hover:text-green-400">
            [MEM] {sortBy === 'memory' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <div>[ACTION]</div>
        </div>
      </div>

      {/* 處理程序列表 */}
      <div className="overflow-y-auto max-h-96 bg-black">
        {filteredProcesses.map((process, index) => (
          <div
            key={process.id}
            className={`px-3 md:px-4 py-2 text-xs border-b border-green-500/20 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-900/20' : 'bg-black'} ${selectedPid === process.pid ? 'bg-green-500/10 ring-1 ring-green-500/60' : 'hover:bg-green-500/10'}`}
            onClick={() => setSelectedPid(process.pid)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedPid(process.pid);
              }
            }}
          >
            {/* Desktop layout */}
            <div className="hidden md:grid grid-cols-12 gap-4">
              <div className="col-span-3 font-medium truncate text-green-400">{process.name}</div>
              <div className="col-span-1 text-center font-mono text-green-300">{process.pid}</div>
              <div className="col-span-1 text-center">
                <span className={`px-2 py-1 rounded text-xs border ${process.status === 'Running' ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-red-500/20 text-red-400 border-red-500'} animate-pulse`}>
                  {process.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-1 text-center text-green-300">{process.user}</div>
              <div className="col-span-1 text-right">
                <span className={`font-mono font-bold ${process.cpu > 20 ? 'text-red-400' : process.cpu > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {process.cpu.toFixed(1)}
                </span>
              </div>
              <div className="col-span-2 text-right font-mono text-green-400">{formatMemory(process.memory)}</div>
              <div className="col-span-1 text-right font-mono text-green-300">{process.threads}</div>
              <div className="col-span-1 text-center">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleKillProcess(process.pid);
                  }}
                  className="w-6 h-6 rounded border border-red-500 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                  title="TERMINATE"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            {/* Mobile layout */}
            <div className="md:hidden">
              <div className="flex justify-between items-start mb-1">
                <div className="font-medium text-green-400 text-sm truncate flex-1 mr-2">{process.name}</div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleKillProcess(process.pid);
                  }}
                  className="w-5 h-5 rounded border border-red-500 hover:bg-red-500/20 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors ml-2"
                  title="TERMINATE"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex space-x-4">
                  <span className="text-green-300">PID: {process.pid}</span>
                  <span className={`${process.cpu > 20 ? 'text-red-400' : process.cpu > 10 ? 'text-yellow-400' : 'text-green-400'} font-bold`}>
                    CPU: {process.cpu.toFixed(1)}%
                  </span>
                  <span className="text-green-300">MEM: {formatMemory(process.memory)}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs border ${process.status === 'Running' ? 'bg-green-500/20 text-green-400 border-green-500' : 'bg-red-500/20 text-red-400 border-red-500'}`}>
                  {process.status.toUpperCase()}
                </span>
              </div>
            </div>
      </div>
    ))}
  </div>

      {/* 進程詳情面板 */}
      {selectedProcess && (
        <div className="px-3 md:px-4 py-4 border-t border-green-500/30 bg-gray-900/40">
          <div className="bg-black/80 border border-green-500/40 rounded-lg p-4 md:p-5 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <div className="text-green-400 text-xs font-bold tracking-widest">[PROCESS_DETAIL]</div>
                <h3 className="text-lg md:text-xl font-bold text-green-200">{selectedProcess.name}</h3>
                <div className="text-green-300 text-xs font-mono">PID: {selectedProcess.pid}</div>
              </div>
              <button
                onClick={() => setSelectedPid(null)}
                className="self-start md:self-center px-2 py-1 border border-green-500/60 text-green-300 rounded hover:bg-green-500/20 transition-colors text-xs"
              >
                CLOSE
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => handleKillProcess(selectedProcess.pid)}
                className="px-3 py-1 rounded border border-red-500 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                TERMINATE
              </button>
              <button
                onClick={() => handleKillProcess(selectedProcess.pid, 'SIGKILL')}
                className="px-3 py-1 rounded border border-red-500 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                FORCE KILL
              </button>
              <button
                onClick={() => handleCopy('PID', String(selectedProcess.pid))}
                className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
              >
                COPY PID
              </button>
              <button
                onClick={() => handleCopy('COMMAND', selectedProcess.command || selectedProcess.name)}
                className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
              >
                COPY CMD
              </button>
              {selectedProcess.path && (
                <button
                  onClick={() => handleCopy('PATH', selectedProcess.path)}
                  className="px-3 py-1 rounded border border-green-500 text-green-300 hover:bg-green-500/20 transition-colors"
                >
                  COPY PATH
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-green-200">
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">STATUS</div>
                <div className="font-bold">{selectedProcess.status}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">USER</div>
                <div className="font-bold">{selectedProcess.user}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">CPU%</div>
                <div className="font-mono font-bold">{selectedProcess.cpu.toFixed(2)}%</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">MEM USAGE</div>
                <div className="font-mono font-bold">
                  {formatMemory(selectedProcess.memory)} (
                  {Number.isFinite(selectedProcess.memoryRaw) ? selectedProcess.memoryRaw.toFixed(2) : '0.00'}%
                  )
                </div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">THREADS</div>
                <div className="font-mono font-bold">{selectedProcess.threads}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">HANDLES</div>
                <div className="font-mono font-bold">{selectedProcess.handles}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">PARENT PID</div>
                <div className="font-mono font-bold">{selectedProcess.parentPid ?? 'N/A'}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">PRIORITY</div>
                <div className="font-mono font-bold">{selectedProcess.priority ?? 'N/A'}</div>
              </div>
              <div className="bg-gray-900/60 border border-green-500/20 rounded p-3">
                <div className="text-green-500/80 text-[10px] tracking-widest">STARTED</div>
                <div className="font-mono font-bold break-all">{selectedProcess.started || 'Unknown'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-green-200">
              {selectedProcess.command && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">COMMAND</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.command}
                  </div>
                </div>
              )}
              {selectedProcess.params && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">ARGS</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.params}
                  </div>
                </div>
              )}
              {selectedProcess.path && (
                <div>
                  <div className="text-green-500/80 text-[10px] tracking-widest">PATH</div>
                  <div className="bg-gray-900/60 border border-green-500/20 rounded p-2 font-mono break-all text-[11px]">
                    {selectedProcess.path}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 狀態列 */}
      <div className="bg-gray-900 px-3 md:px-4 py-2 border-t border-green-500/30 text-xs text-green-300">
        <div className="flex flex-col md:flex-row justify-between space-y-1 md:space-y-0">
          <span>DISPLAY: {filteredProcesses.length}/{processes.length} PROC</span>
          <span className="animate-pulse">
            {isMobile ? (
              `CPU:${systemStats.totalCpu.toFixed(0)}% GPU:${systemStats.gpuUsage.toFixed(0)}% PWR:${systemStats.totalPower.toFixed(0)}W BAT:${systemStats.batteryLevel.toFixed(0)}%`
            ) : (
              `UPDATE: ${(updateInterval / 1000).toFixed(1)}s | CPU: ${systemStats.totalCpu.toFixed(1)}% | GPU: ${systemStats.gpuUsage.toFixed(1)}% | PWR: ${systemStats.totalPower.toFixed(1)}W | BAT: ${systemStats.batteryLevel.toFixed(0)}% | TIME: ${currentTime.toLocaleTimeString()}`
            )}
          </span>
        </div>
      </div>
      {renderSettingsModal()}
    </div>
  );
};

export default TaskManager;
