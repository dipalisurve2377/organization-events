import axios from "axios";

export const updateUser = async (id: string, updates: { name: string }) => {
  return axios.put(`http://localhost:7001/api/users/${id}`, { updates });
};

export const getUser = async (id: string) => {
  const res = await axios.get<any>(`http://localhost:7001/api/users/${id}`);
  return res.data.user;
};

export const deleteUser = async (id: string) => {
  return axios.delete(`http://localhost:7001/api/users/${id}`);
};
