import React from 'react'
import { Zap, Activity } from 'lucide-react'

const PerformancePanel = ({
  tabs,
  activeTab,
  onTabChange,
  isMobile,
  data,
  helpers
}) => {
  const { formatThroughput, formatIops, formatMemory, formatStorage, getCpuBarColor } = helpers
  const { systemInfo, systemStats, cpuLoad, performanceHistory } = data.cpu
  const { gpuLoad, selectedGpuIndex, onSelectGpu, activeGpuHistory, gpuHistoryMax, gpuMemoryUsage } = data.gpu
  const { netDownMax, netUpMax } = data.network
  const { diskReadMax, diskWriteMax } = data.storage

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 text-xs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          className={`px-3 py-1 rounded border transition-colors ${activeTab === tab.id ? 'bg-green-500/30 border-green-400 text-green-100' : tab.disabled ? 'border-green-500/10 text-green-500/40 cursor-not-allowed' : 'border-green-500/30 text-green-300 hover:bg-green-500/10'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )

  const renderCpuCard = () => (
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
            <div>UPTIME: <span className="text-green-300 font-bold">{systemStats.uptime}</span></div>
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
  )
  const renderGpuCard = () => {
    const activeGpu = gpuLoad[selectedGpuIndex] || gpuLoad[0] || null
    const activeHistory = activeGpuHistory
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
                  onClick={() => onSelectGpu(index)}
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
            {activeHistory.slice(isMobile ? -20 : -30).map((value, index) => (
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

        {(!activeGpu || !Number.isFinite(activeGpu?.utilizationGpu)) && (
          <p className="text-[10px] text-green-300/80">
            * GPU 利用率由系統回報。若無法取得，將顯示推估或保持 0。
          </p>
        )}
      </div>
    )
  }

  const renderNetworkCard = () => (
    <div className="space-y-4 border border-green-500/30 p-3 md:p-4 rounded bg-gray-900/50">
      <h3 className="text-base md:text-lg font-bold text-green-400">[NETWORK] THROUGHPUT</h3>
      <div className="bg-black/50 p-2 md:p-3 rounded border border-green-500/20">
        <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs">
          <div>DOWN: <span className="text-green-300 font-bold">{formatThroughput(systemStats.networkDown)}</span></div>
          <div>UP: <span className="text-green-300 font-bold">{formatThroughput(systemStats.networkUp)}</span></div>
          <div>INTERFACES: <span className="text-green-300 font-bold">{data.network.interfacesCount}</span></div>
          <div>TOP: <span className="text-green-300 font-bold">{(systemStats.networkTop[0]?.name) || 'N/A'}</span></div>
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
  )

  const renderStorageCard = () => (
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
  )

  const renderCard = () => {
    switch (activeTab) {
      case 'gpu':
        return renderGpuCard()
      case 'network':
        return renderNetworkCard()
      case 'storage':
        return renderStorageCard()
      case 'cpu':
      default:
        return renderCpuCard()
    }
  }

  return (
    <div className="space-y-4">
      {renderTabs()}
      {renderCard()}
    </div>
  )
}

export default PerformancePanel
