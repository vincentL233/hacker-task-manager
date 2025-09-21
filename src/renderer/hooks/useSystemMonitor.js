import { useState, useEffect } from 'react'
import { createHistoryArray, adjustHistoryArray, appendHistory } from '../utils/history'

const createInitialHistory = (length) => ({
  cpu: createHistoryArray(length),
  memory: createHistoryArray(length),
  gpu: createHistoryArray(length),
  netUp: createHistoryArray(length),
  netDown: createHistoryArray(length),
  diskRead: createHistoryArray(length),
  diskWrite: createHistoryArray(length)
})

const useSystemMonitor = ({ isElectron, updateInterval, historyLength }) => {
  const [systemInfo, setSystemInfo] = useState(null)
  const [processes, setProcesses] = useState([])
  const [cpuLoad, setCpuLoad] = useState(null)
  const [gpuLoad, setGpuLoad] = useState([])
  const [selectedGpuIndex, setSelectedGpuIndex] = useState(0)
  const [gpuHistory, setGpuHistory] = useState([])
  const [networkStats, setNetworkStats] = useState([])
  const [networkInterfaces, setNetworkInterfaces] = useState([])
  const [fsStats, setFsStats] = useState(null)
  const [diskStats, setDiskStats] = useState(null)
  const [storageDevices, setStorageDevices] = useState([])
  const [performanceHistory, setPerformanceHistory] = useState(() => createInitialHistory(historyLength))
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    setPerformanceHistory(prev => ({
      cpu: adjustHistoryArray(prev.cpu, historyLength),
      memory: adjustHistoryArray(prev.memory, historyLength),
      gpu: adjustHistoryArray(prev.gpu, historyLength),
      netUp: adjustHistoryArray(prev.netUp, historyLength),
      netDown: adjustHistoryArray(prev.netDown, historyLength),
      diskRead: adjustHistoryArray(prev.diskRead, historyLength),
      diskWrite: adjustHistoryArray(prev.diskWrite, historyLength)
    }))
    setGpuHistory(prev => prev.map(history => adjustHistoryArray(history, historyLength)))
  }, [historyLength])

  const fetchSystemData = async () => {
    if (!isElectron || !window?.electronAPI) {
      return
    }

    try {
      const [sysInfo, cpuLoadData, gpuLoadData, ioStats] = await Promise.all([
        window.electronAPI.getSystemInfo(),
        window.electronAPI.getCpuLoad(),
        window.electronAPI.getGpuLoad(),
        window.electronAPI.getIoStats()
      ])

      if (sysInfo) {
        setSystemInfo(sysInfo)

        const totalMemoryBytes = sysInfo.memory?.total || 16000000000
        const totalMemoryMb = totalMemoryBytes / 1024 / 1024

        const processData = sysInfo.processes.map((proc, index) => {
          const cpuCandidates = [proc.pcpu, proc.cpu, proc.cpuPercent]
          const resolvedCpu = cpuCandidates
            .map(value => (typeof value === 'number' ? value : Number(value)))
            .find(value => Number.isFinite(value)) || 0

          const rawPercent = typeof proc.pmem === 'number' ? proc.pmem : Number(proc.pmem) || 0
          const rawMemRss = typeof proc.memRss === 'number' ? proc.memRss : Number(proc.memRss) || 0
          const rawMemVsz = typeof proc.memVsz === 'number' ? proc.memVsz : Number(proc.memVsz) || 0

          const memoryMbFromPercent = rawPercent > 0
            ? (rawPercent * totalMemoryBytes) / 100 / 1024 / 1024
            : 0
          const memoryMbFromRss = rawMemRss > 0 ? rawMemRss / 1024 / 1024 : 0
          const memoryMbFromVsz = rawMemVsz > 0 ? rawMemVsz / 1024 / 1024 : 0

          const memoryMb = [memoryMbFromPercent, memoryMbFromRss, memoryMbFromVsz]
            .find(value => Number.isFinite(value) && value > 0) || 0

          const memoryPercentCandidate = memoryMb > 0 && totalMemoryMb > 0
            ? (memoryMb / totalMemoryMb) * 100
            : rawPercent
          const memoryPercent = Number.isFinite(memoryPercentCandidate)
            ? memoryPercentCandidate
            : 0

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
          }
        })

        setProcesses(processData)

        if (Array.isArray(sysInfo.fsSize) && sysInfo.fsSize.length > 0) {
          setStorageDevices(sysInfo.fsSize)
        }
      }

      if (cpuLoadData) {
        const resolveLoadValue = (...values) => values
          .map(value => (typeof value === 'number' ? value : Number(value)))
          .find(value => Number.isFinite(value))

        const normalizedCores = Array.isArray(cpuLoadData.cores)
          ? cpuLoadData.cores.map(core => {
              const resolvedLoad = resolveLoadValue(
                core.load,
                core.loadCombined,
                core.currentLoad
              ) || 0
              const resolvedUserLoad = resolveLoadValue(
                core.loadUser,
                core.user,
                core.currentLoadUser
              ) || 0
              const resolvedSystemLoad = resolveLoadValue(
                core.loadSystem,
                core.system,
                core.currentLoadSystem
              ) || 0

              return {
                ...core,
                load: resolvedLoad,
                userLoad: resolvedUserLoad,
                systemLoad: resolvedSystemLoad
              }
            })
          : []

        const averageFromCores = (key) => normalizedCores.length
          ? normalizedCores.reduce((sum, core) => sum + (core[key] || 0), 0) / normalizedCores.length
          : 0

        const normalizedOverall = resolveLoadValue(
          cpuLoadData.overall,
          cpuLoadData.currentLoad,
          cpuLoadData.currentload
        )
        const normalizedUserTop = resolveLoadValue(
          cpuLoadData.user,
          cpuLoadData.currentLoadUser,
          cpuLoadData.currentload_user
        )
        const normalizedSystemTop = resolveLoadValue(
          cpuLoadData.system,
          cpuLoadData.currentLoadSystem,
          cpuLoadData.currentload_system
        )

        const normalizedOverallFinal = Number.isFinite(normalizedOverall)
          ? normalizedOverall
          : averageFromCores('load')
        const normalizedUserFinal = Number.isFinite(normalizedUserTop)
          ? normalizedUserTop
          : averageFromCores('userLoad')
        const normalizedSystemFinal = Number.isFinite(normalizedSystemTop)
          ? normalizedSystemTop
          : averageFromCores('systemLoad')

        setCpuLoad({
          overall: normalizedOverallFinal || 0,
          user: normalizedUserFinal || 0,
          system: normalizedSystemFinal || 0,
          cores: normalizedCores
        })

        const primaryGpuUsage = gpuLoadData && gpuLoadData[0]
          ? Number.isFinite(gpuLoadData[0].utilizationGpu) ? gpuLoadData[0].utilizationGpu : 0
          : 0

        setPerformanceHistory(prev => ({
          ...prev,
          cpu: appendHistory(prev.cpu, normalizedOverallFinal || 0, historyLength),
          memory: appendHistory(prev.memory, sysInfo?.memory ? (sysInfo.memory.used / sysInfo.memory.total * 100) : 0, historyLength),
          gpu: appendHistory(prev.gpu, primaryGpuUsage, historyLength)
        }))
      }

      if (gpuLoadData && gpuLoadData.length > 0) {
        setGpuLoad(gpuLoadData)
        setGpuHistory(prev => {
          return gpuLoadData.map((gpu, index) => {
            const utilization = Number.isFinite(gpu?.utilizationGpu) ? gpu.utilizationGpu : 0
            const history = prev[index] || createHistoryArray(historyLength)
            return appendHistory(history, utilization, historyLength)
          })
        })

        setSelectedGpuIndex(index => {
          if (index >= gpuLoadData.length) {
            return 0
          }
          return index
        })
      }

      if (ioStats) {
        const networkArray = Array.isArray(ioStats.network) ? ioStats.network : []
        const ifaceList = Array.isArray(ioStats.networkInterfaces) ? ioStats.networkInterfaces : []
        const fsData = ioStats.fsStats || null
        const diskData = ioStats.disks || null
        const fsSizeData = Array.isArray(ioStats.fsSize) ? ioStats.fsSize : []

        setNetworkStats(networkArray)
        setNetworkInterfaces(ifaceList)
        setFsStats(fsData)
        setDiskStats(diskData)
        setStorageDevices(prevDevices => {
          if (fsSizeData.length > 0) {
            return fsSizeData
          }
          if (Array.isArray(systemInfo?.fsSize) && systemInfo.fsSize.length > 0) {
            return systemInfo.fsSize
          }
          return prevDevices
        })

        const aggregatedNetwork = networkArray.reduce((acc, iface) => {
          const rx = Number(iface?.rx_sec) || 0
          const tx = Number(iface?.tx_sec) || 0
          return {
            rx: acc.rx + rx,
            tx: acc.tx + tx
          }
        }, { rx: 0, tx: 0 })

        const netDownMbps = aggregatedNetwork.rx / 1024 / 1024
        const netUpMbps = aggregatedNetwork.tx / 1024 / 1024

        const diskReadMB = fsData && Number.isFinite(fsData.rx_sec) ? fsData.rx_sec / 1024 / 1024 : 0
        const diskWriteMB = fsData && Number.isFinite(fsData.wx_sec) ? fsData.wx_sec / 1024 / 1024 : 0

        setPerformanceHistory(prev => ({
          ...prev,
          netUp: appendHistory(prev.netUp, netUpMbps, historyLength),
          netDown: appendHistory(prev.netDown, netDownMbps, historyLength),
          diskRead: appendHistory(prev.diskRead, diskReadMB, historyLength),
          diskWrite: appendHistory(prev.diskWrite, diskWriteMB, historyLength)
        }))
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error fetching system data:', error)
    }
  }

  useEffect(() => {
    if (!isElectron) {
      return undefined
    }

    let cancelled = false

    const runFetch = () => {
      if (cancelled) return
      fetchSystemData()
    }

    runFetch()
    const interval = setInterval(runFetch, updateInterval)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isElectron, updateInterval, historyLength])

  return {
    systemInfo,
    processes,
    cpuLoad,
    gpuLoad,
    selectedGpuIndex,
    setSelectedGpuIndex,
    gpuHistory,
    networkStats,
    networkInterfaces,
    fsStats,
    diskStats,
    storageDevices,
    performanceHistory,
    lastUpdated
  }
}

export default useSystemMonitor
