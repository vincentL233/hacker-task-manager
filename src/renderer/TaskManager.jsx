import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Terminal, Zap, Activity, AlertTriangle } from 'lucide-react';

const TaskManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('cpu');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTab, setSelectedTab] = useState('processes');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [selectedPid, setSelectedPid] = useState(null);
  
  // 系統數據狀態
  const [systemInfo, setSystemInfo] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [cpuLoad, setCpuLoad] = useState(null);
  const [gpuLoad, setGpuLoad] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState({
    cpu: Array.from({length: 60}, () => 0),
    memory: Array.from({length: 60}, () => 0),
    gpu: Array.from({length: 60}, () => 0)
  });
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

  // 獲取真實系統數據
  const fetchSystemData = async () => {
    if (!isElectron || !window.electronAPI) {
      console.log('Not in Electron environment, using mock data');
      return;
    }

    try {
      // 並行獲取所有系統信息
      const [sysInfo, cpuLoadData, gpuLoadData] = await Promise.all([
        window.electronAPI.getSystemInfo(),
        window.electronAPI.getCpuLoad(),
        window.electronAPI.getGpuLoad()
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
      }

      if (cpuLoadData) {
        const normalizedOverall = Number.isFinite(cpuLoadData.overall) ? cpuLoadData.overall : 0;
        const normalizedCores = Array.isArray(cpuLoadData.cores)
          ? cpuLoadData.cores.map(core => {
              const loadCandidates = [core.load, core.loadCombined, core.currentLoad];
              const resolvedLoad = loadCandidates
                .map(value => (typeof value === 'number' ? value : Number(value)))
                .find(value => Number.isFinite(value)) || 0;

              return {
                ...core,
                load: resolvedLoad
              };
            })
          : [];

        setCpuLoad({
          overall: normalizedOverall,
          cores: normalizedCores
        });
        
        // 更新性能歷史
        setPerformanceHistory(prev => ({
          cpu: [...prev.cpu.slice(1), normalizedOverall],
          memory: [...prev.memory.slice(1), sysInfo?.memory ? (sysInfo.memory.used / sysInfo.memory.total * 100) : 0],
          gpu: [...prev.gpu.slice(1), gpuLoadData[0]?.utilizationGpu || 0]
        }));
      }

      if (gpuLoadData && gpuLoadData.length > 0) {
        setGpuLoad(gpuLoadData);
      }

    } catch (error) {
      console.error('Error fetching system data:', error);
    }
  };

  // 定時更新數據
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSystemData();
      setCurrentTime(new Date());
    }, 2000); // 每2秒更新一次

    // 立即獲取一次數據
    fetchSystemData();

    return () => clearInterval(interval);
  }, [isElectron]);

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
    cpuSpeed: systemInfo?.cpu?.speed ? `${(systemInfo.cpu.speed / 1000).toFixed(1)} GHz` : '3.2 GHz',
    cpuTemp: Math.round(systemInfo?.temperature?.main || 45),
    cpuPower: (cpuLoad?.overall || 0) / 100 * 15 + 5,
    gpuUsage: gpuLoad[0]?.utilizationGpu || 0,
    gpuMemory: gpuLoad[0]?.memoryUsed || 0,
    gpuTemp: Math.round(gpuLoad[0]?.temperatureGpu || 40),
    gpuPower: (gpuLoad[0]?.utilizationGpu || 0) / 100 * 25 + 8,
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
            <div className="flex space-x-2 md:space-x-4 text-xs">
              <button onClick={() => setSelectedTab('processes')} className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded">PROC</button>
              <button onClick={() => setSelectedTab('performance')} className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded">PERF</button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 lg:gap-6">
            {/* CPU 資訊 */}
            <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
              <h3 className="text-base md:text-lg font-bold text-green-400 flex items-center space-x-2">
                <Zap className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                <span className="text-sm md:text-base">[CPU_CORE] {systemInfo?.cpu?.manufacturer} {systemInfo?.cpu?.brand}</span>
              </h3>
              <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
                <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                  <div>USAGE: <span className="text-green-300 font-bold">{systemStats.totalCpu.toFixed(1)}%</span></div>
                  <div>POWER: <span className="text-green-300 font-bold">{systemStats.cpuPower.toFixed(1)}W</span></div>
                  <div>FREQ: <span className="text-green-300 font-bold">{systemStats.cpuSpeed}</span></div>
                  <div>TEMP: <span className="text-green-300 font-bold">{systemStats.cpuTemp}°C</span></div>
                  <div>CORES: <span className="text-green-300 font-bold">{systemInfo?.cpu?.cores || 'N/A'}</span></div>
                  <div>THREADS: <span className="text-green-300 font-bold">{systemInfo?.cpu?.processors || 'N/A'}</span></div>
                </div>
              </div>

              {/* CPU 核心負載 */}
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
                            style={{width: `${core.load}%`}}
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
            {/* GPU 資訊 */}
            <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
              <h3 className="text-base md:text-lg font-bold text-green-400 flex items-center space-x-2">
                <Activity className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                <span className="text-sm md:text-base">[GPU] {gpuLoad[0]?.model || 'INTEGRATED'}</span>
              </h3>
              <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
                <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
                  <div>USAGE: <span className="text-green-300 font-bold">{systemStats.gpuUsage.toFixed(1)}%</span></div>
                  <div>POWER: <span className="text-green-300 font-bold">{systemStats.gpuPower.toFixed(1)}W</span></div>
                  <div>VMEM: <span className="text-green-300 font-bold">{formatMemory(systemStats.gpuMemory)}</span></div>
                  <div>TEMP: <span className="text-green-300 font-bold">{systemStats.gpuTemp}°C</span></div>
                </div>
              </div>
            </div>

            {/* 記憶體和功耗資訊 */}
            <div className="lg:col-span-2 2xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        style={{width: `${(systemStats.usedMemory / systemStats.totalMemory) * 100}%`}}
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
                            style={{height: `${(value / 100) * 100}%`}}
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
                            style={{height: `${(value / 100) * 100}%`}}
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
          <div className="flex space-x-2 md:space-x-4 text-xs">
            <button onClick={() => setSelectedTab('processes')} className="px-2 md:px-3 py-1 bg-green-500/20 text-green-300 border border-green-400 rounded">PROC</button>
            <button onClick={() => setSelectedTab('performance')} className="px-2 md:px-3 py-1 border border-green-500 text-green-400 hover:bg-green-500/20 rounded">PERF</button>
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
              `UPDATE: 2s | CPU: ${systemStats.totalCpu.toFixed(1)}% | GPU: ${systemStats.gpuUsage.toFixed(1)}% | PWR: ${systemStats.totalPower.toFixed(1)}W | BAT: ${systemStats.batteryLevel.toFixed(0)}% | TIME: ${currentTime.toLocaleTimeString()}`
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskManager;
