import { useState, useRef } from 'react';
import api from '@/services/api';
import { usePortfolioItems, useAddPortfolioItem, useDeletePortfolioItem } from '@/hooks/useProfiles';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface PortfolioUploaderProps {
  profileId: string;
  skills: { skill: string }[];
}

const ACCEPTED_TYPES: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/quicktime': 'video',
};

export default function PortfolioUploader({ profileId, skills }: PortfolioUploaderProps) {
  const { data: items = [] } = usePortfolioItems(profileId);
  const addItem = useAddPortfolioItem();
  const deleteItem = useDeletePortfolioItem();
  const [uploadingMap, setUploadingMap] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  const startUpload = (skill: string) =>
    setUploadingMap((prev) => ({ ...prev, [skill]: (prev[skill] ?? 0) + 1 }));
  const endUpload = (skill: string) =>
    setUploadingMap((prev) => {
      const count = (prev[skill] ?? 1) - 1;
      if (count <= 0) {
        const { [skill]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [skill]: count };
    });

  const handleUpload = async (file: File, skillName: string) => {
    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      toast.error('Unsupported file type. Use images, PDFs, or videos.');
      return;
    }

    startUpload(skillName);
    try {
      // Upload file through backend
      const { data: uploaded } = await api.post(
        `/upload/file?fileName=${encodeURIComponent(file.name)}&folder=portfolio`,
        file,
        { headers: { 'Content-Type': file.type } }
      );

      // Add portfolio item
      await addItem.mutateAsync({
        profileId,
        skill_name: skillName,
        file_url: uploaded.fileUrl,
        file_type: fileType,
        file_name: file.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error(`Portfolio upload error for "${file.name}":`, err);
      toast.error(message.length > 120 ? message.slice(0, 120) + '...' : message);
      throw err;
    } finally {
      endUpload(skillName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSkill) {
      e.target.value = '';
      return;
    }

    const skill = activeSkill;
    const fileArray = Array.from(files);

    Promise.allSettled(fileArray.map((file) => handleUpload(file, skill))).then(
      (results) => {
        if (fileArray.length > 1) {
          const failed = results.filter((r) => r.status === 'rejected').length;
          const succeeded = fileArray.length - failed;
          if (succeeded > 0) {
            toast.success(`${succeeded} of ${fileArray.length} files uploaded`);
          }
        }
      }
    );

    e.target.value = '';
  };

  const triggerUpload = (skillName: string) => {
    setActiveSkill(skillName);
    fileInputRef.current?.click();
  };

  // Group items by skill
  const itemsBySkill: Record<string, any[]> = {};
  for (const item of items) {
    if (!itemsBySkill[item.skill_name]) itemsBySkill[item.skill_name] = [];
    itemsBySkill[item.skill_name].push(item);
  }

  if (skills.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Portfolio</h3>
      <p className="mb-4 text-xs text-gray-500">
        Upload images, PDFs, or videos for each skill to showcase your work
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,video/mp4,video/quicktime"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="space-y-6">
        {skills.map(({ skill }) => (
          <div key={skill} className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">{skill}</h4>
              <Button
                variant="outline"
                size="sm"
                loading={(uploadingMap[skill] ?? 0) > 0}
                onClick={() => triggerUpload(skill)}
              >
                {(uploadingMap[skill] ?? 0) > 1
                  ? `Uploading ${uploadingMap[skill]}...`
                  : 'Upload'}
              </Button>
            </div>

            {(itemsBySkill[skill] ?? []).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(itemsBySkill[skill] ?? []).map((item: any) => (
                  <div key={item.id} className="group relative rounded-lg border border-gray-100 p-2">
                    {item.file_type === 'image' && (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="h-24 w-full rounded-md object-cover"
                      />
                    )}
                    {item.file_type === 'video' && (
                      <video
                        src={item.file_url}
                        className="h-24 w-full rounded-md object-cover"
                      />
                    )}
                    {item.file_type === 'pdf' && (
                      <div className="flex h-24 items-center justify-center rounded-md bg-red-50">
                        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <p className="mt-1 truncate text-xs text-gray-600">{item.file_name}</p>
                    <button
                      type="button"
                      onClick={() => deleteItem.mutate({ profileId, itemId: item.id })}
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
              <p className="text-xs text-gray-400">No portfolio items yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
