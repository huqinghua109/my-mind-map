import request from './request'

export const auth = {
  register: data => request.post('/auth/register', data),
  login: data => request.post('/auth/login', data),
  me: () => request.get('/auth/me')
}

export const user = {
  profile: () => request.get('/user/profile'),
  updateProfile: data => request.put('/user/profile', data),
  uploadAvatar: formData =>
    request.post('/user/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const teams = {
  list: () => request.get('/teams'),
  create: data => request.post('/teams', data),
  members: id => request.get(`/teams/${id}/members`),
  invite: id => request.post(`/teams/${id}/invite`),
  join: code => request.post('/teams/join', { code }),
  removeMember: (teamId, userId) => request.delete(`/teams/${teamId}/members/${userId}`),
  leave: id => request.post(`/teams/${id}/leave`),
  createFile: (id, data) => request.post(`/teams/${id}/files`, data),
  teamFiles: id => request.get(`/teams/${id}/files`)
}

export const files = {
  createPersonal: data => request.post('/files/personal', data),
  personalList: () => request.get('/files/personal'),
  detail: id => request.get(`/files/${id}`),
  update: (id, data) => request.put(`/files/${id}`, data),
  remove: id => request.delete(`/files/${id}`)
}

export const upload = {
  image: formData =>
    request.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
}

export const ai = {
  getConfig: () => request.get('/ai/config'),
  saveConfig: data => request.put('/ai/config', data),
  chat: data => request.post('/ai/chat', data, { responseType: 'stream' })
}
