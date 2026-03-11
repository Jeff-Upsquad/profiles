import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { usePortfolio } from '../../hooks/usePortfolio';
import api from '../../services/api';
import './Dashboard.css';

const ACCEPTED_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
};

export default function Upload() {
  const { uploadFiles } = usePortfolio();
  const [step, setStep] = useState('select'); // 'select' | 'uploading' | 'metadata'
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [metadata, setMetadata] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/types')])
      .then(([catRes, typeRes]) => {
        setCategories(catRes.data.categories);
        setTypes(typeRes.data.types);
      })
      .catch(() => {});
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 50) {
      setError('Maximum 50 files per upload');
      return;
    }
    setFiles(acceptedFiles);
    setError('');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 50,
  });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setStep('uploading');
    setError('');

    try {
      const items = await uploadFiles(files, setProgress);
      setUploadedItems(items);
      setMetadata(items.map(item => ({
        id: item._id,
        title: item.originalFilename?.replace(/\.[^/.]+$/, '') || 'Untitled',
        description: '',
        category: '',
        type: '',
      })));
      setStep('metadata');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
      setStep('select');
    }
  };

  const updateMetadataField = (index, field, value) => {
    setMetadata(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleSaveMetadata = async () => {
    setSaving(true);
    setError('');

    try {
      for (const item of metadata) {
        await api.put(`/portfolio/${item.id}`, {
          title: item.title || 'Untitled',
          description: item.description,
          category: item.category || undefined,
          type: item.type || undefined,
          status: 'published',
        });
      }
      setStep('select');
      setFiles([]);
      setUploadedItems([]);
      setMetadata([]);
      alert('All items published successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'uploading') {
    return (
      <div className="page">
        <h1 className="page-title">Uploading...</h1>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="progress-text">{progress}% uploaded</p>
      </div>
    );
  }

  if (step === 'metadata') {
    return (
      <div className="page">
        <h1 className="page-title">Add Details to Your Work</h1>
        <p className="page-subtitle">Fill in the details for each uploaded file, then publish.</p>

        {error && <div className="error-msg">{error}</div>}

        <div className="metadata-list">
          {uploadedItems.map((item, index) => (
            <div key={item._id} className="metadata-card">
              <div className="metadata-preview">
                {item.fileType === 'image' ? (
                  <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${item.fileUrl}`} alt="" />
                ) : (
                  <div className="video-placeholder">Video</div>
                )}
              </div>
              <div className="metadata-fields">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={metadata[index]?.title || ''}
                    onChange={e => updateMetadataField(index, 'title', e.target.value)}
                    placeholder="Title"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={metadata[index]?.description || ''}
                    onChange={e => updateMetadataField(index, 'description', e.target.value)}
                    placeholder="Describe this work"
                    rows={2}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={metadata[index]?.category || ''}
                      onChange={e => updateMetadataField(index, 'category', e.target.value)}
                    >
                      <option value="">Select category</option>
                      {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={metadata[index]?.type || ''}
                      onChange={e => updateMetadataField(index, 'type', e.target.value)}
                    >
                      <option value="">Select type</option>
                      {types.map(t => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleSaveMetadata} className="auth-btn" disabled={saving}>
          {saving ? 'Publishing...' : `Publish All (${uploadedItems.length} items)`}
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Upload Your Work</h1>
      <p className="page-subtitle">Upload up to 50 images or videos at once</p>

      {error && <div className="error-msg">{error}</div>}

      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop files here...</p>
        ) : (
          <div className="dropzone-content">
            <p className="dropzone-text">Drag & drop files here, or click to select</p>
            <p className="dropzone-hint">PNG, JPG, JPEG, MP4, MOV — Max 50 files</p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="selected-files">
          <p className="files-count">{files.length} file(s) selected</p>
          <div className="file-list">
            {files.map((file, i) => (
              <div key={i} className="file-item">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
          <button onClick={handleUpload} className="auth-btn">
            Upload {files.length} File(s)
          </button>
        </div>
      )}
    </div>
  );
}
