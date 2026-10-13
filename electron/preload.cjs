const { contextBridge, ipcRenderer } = require('electron');
ipcRenderer.on('video:progress', (_event, progress) => window.dispatchEvent(new CustomEvent('studio-video-progress', { detail: progress })));

contextBridge.exposeInMainWorld('studio', {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listSpeechVoices: () => ipcRenderer.invoke('tts:list-voices'),
  listEdgeVoices: () => ipcRenderer.invoke('tts:list-edge-voices'),
  splitScript: (payload) => ipcRenderer.invoke('ai:split-script', payload),
  generateSpeech: (payload) => ipcRenderer.invoke('tts:generate', payload),
  chooseImage: () => ipcRenderer.invoke('image:choose'),
  exportVideo: (bytes) => ipcRenderer.invoke('video:export', bytes),
  saveDraft: (payload) => ipcRenderer.invoke('projects:save-draft', payload),
  chooseWorkspace: (currentPath) => ipcRenderer.invoke('workspace:choose', currentPath),
  listProjects: (options) => ipcRenderer.invoke('projects:list', options),
  openProjectFile: (options) => ipcRenderer.invoke('projects:open', options),
});
