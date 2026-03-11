import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function usePortfolio() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/portfolio/my');
      setItems(res.data.items);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const uploadFiles = async (files, onProgress) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const res = await api.post('/portfolio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      }
    });
    return res.data.items;
  };

  const updateItem = async (id, data) => {
    const res = await api.put(`/portfolio/${id}`, data);
    setItems(prev => prev.map(item => item._id === id ? res.data.item : item));
    return res.data.item;
  };

  const deleteItem = async (id) => {
    await api.delete(`/portfolio/${id}`);
    setItems(prev => prev.filter(item => item._id !== id));
  };

  return { items, loading, error, fetchItems, uploadFiles, updateItem, deleteItem };
}
