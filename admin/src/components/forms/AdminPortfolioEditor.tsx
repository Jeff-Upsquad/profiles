import { useRef, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface Props {
  profileId: string;
  skills: { skill: string }[];
}

interface PortfolioItem {
  id: string;
  skill_name: string;
  file_url: string;
  file_type: 'image' | 'pdf' | 'video';
  file_name: string;
  source_type?: string;
  provider?: string;
  thumbnail_url?: string | null;
}

const ACCEPTED_TYPES: Record<string, 'image' | 'pdf' | 'video'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/quicktime': 'video',
};

const MAX_BYTES = 500 * 1024 * 1024;

export default function AdminPortfolioEditor({ profileId, skills }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});

  const { data: items = [] } = useQuery<PortfolioItem[]>({
    queryKey: ['admin-portfolio', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/profiles/${profileId}/portfolio`);
      return data.items ?? [];
    },
    enabled: !!profileId,
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/admin/talents/profiles/${profileId}/portfolio/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-portfolio', profileId] });
      queryClient.invalidateQueries({ queryKey: ['talent-profile', profileId] });
      toast.success('Item deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const handleUpload = async (file: File, skillName: string) => {
    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      toast.error('Unsupported file type. Use images, PDFs, or videos.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('File too large. Max upload is 500 MB.');
      return;
    }
    const key = `${skillName}::${file.name}`;
    setUploading((prev) => ({ ...prev, [key]: 0 }));
    try {
      const { data: presigned } = await api.post('/upload/presigned-url', {
        fileName: file.name,
        contentType: file.type,
        contentLength: file.size,
        folder: 'portfolio',
      });

      await axios.put(presigned.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploading((prev) => ({ ...prev, [key]: pct }));
        },
        timeout: 30 * 60 * 1000,
      });

      await api.post(`/admin/talents/profiles/${profileId}/portfolio`, {
        skill_name: skillName,
        file_url: presigned.fileUrl,
        file_type: fileType,
        file_name: file.name,
        source_type: 'upload',
      });

      queryClient.invalidateQueries({ queryKey: ['admin-portfolio', profileId] });
      queryClient.invalidateQueries({ queryKey: ['talent-profile', profileId] });
      toast.success('Uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const triggerUpload = (skillName: string) => {
    setActiveSkill(skillName);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activeSkill) {
      e.target.value = '';
      return;
    }
    const skill = activeSkill;
    Promise.allSettled(Array.from(files).map((f) => handleUpload(f, skill)));
    e.target.value = '';
  };

  const itemsBySkill: Record<string, PortfolioItem[]> = {};
  for (const item of items) {
    if (!itemsBySkill[item.skill_name]) itemsBySkill[item.skill_name] = [];
    itemsBySkill[item.skill_name].push(item);
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Portfolio</h3>
      <p className="mb-4 text-xs text-gray-500">
        Upload images, PDFs, or videos per skill. Max 500 MB per file.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,video/mp4,video/quicktime"
        multiple
        onChange={onFileSelected}
        className="hidden"
      />

      {skills.length === 0 ? (
        <p className="text-sm text-gray-400">Select at least one skill above to add portfolio items.</p>
      ) : (
        <div className="space-y-4">
          {skills.map(({ skill }) => {
            const skillUploads = Object.entries(uploading).filter(([k]) => k.startsWith(`${skill}::`));
            return (
              <div key={skill} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">{skill}</h4>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={skillUploads.length > 0}
                    onClick={() => triggerUpload(skill)}
                  >
                    Upload
                  </Button>
                </div>

                {skillUploads.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {skillUploads.map(([k, pct]) => (
                      <div key={k}>
                        <div className="mb-1 flex justify-between text-xs text-gray-600">
                          <span className="truncate pr-2">{k.split('::')[1]}</span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full bg-indigo-600 transition-all duration-150" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(itemsBySkill[skill] ?? []).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {itemsBySkill[skill].map((item) => (
                      <div key={item.id} className="group relative rounded-lg border border-gray-100 p-2">
                        {item.file_type === 'image' && (
                          <img src={item.file_url} alt={item.file_name} className="h-24 w-full rounded-md object-cover" />
                        )}
                        {item.file_type === 'video' && (
                          <video src={item.file_url} className="h-24 w-full rounded-md object-cover" />
                        )}
                        {item.file_type === 'pdf' && (
                          <div className="flex h-24 items-center justify-center rounded-md bg-red-50 text-xs text-red-500">PDF</div>
                        )}
                        <p className="mt-1 truncate text-xs text-gray-600">{item.file_name}</p>
                        <button
                          type="button"
                          onClick={() => deleteItem.mutate(item.id)}
                          className="absolute right-1 top-1 hidden rounded-full bg-white p-1 text-red-500 shadow hover:bg-red-50 group-hover:block"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No items yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
