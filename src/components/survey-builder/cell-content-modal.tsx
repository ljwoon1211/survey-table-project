'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TableCell, CheckboxOption, RadioOption } from '@/types/survey';
import { Type, Image, Video, CheckSquare, Circle } from 'lucide-react';

interface CellContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cell: TableCell;
  onSave: (cell: TableCell) => void;
}

export function CellContentModal({ isOpen, onClose, cell, onSave }: CellContentModalProps) {
  const [contentType, setContentType] = useState<'text' | 'image' | 'video' | 'checkbox' | 'radio'>(cell.type || 'text');
  const [textContent, setTextContent] = useState(cell.content || '');
  const [imageUrl, setImageUrl] = useState(cell.imageUrl || '');
  const [videoUrl, setVideoUrl] = useState(cell.videoUrl || '');
  const [checkboxOptions, setCheckboxOptions] = useState<CheckboxOption[]>(cell.checkboxOptions || []);
  const [radioOptions, setRadioOptions] = useState<RadioOption[]>(cell.radioOptions || []);
  const [radioGroupName, setRadioGroupName] = useState(cell.radioGroupName || '');

  const handleSave = () => {
    const updatedCell: TableCell = {
      ...cell,
      type: contentType,
      content: contentType === 'text' ? textContent : '',
      imageUrl: contentType === 'image' ? imageUrl : undefined,
      videoUrl: contentType === 'video' ? videoUrl : undefined,
      checkboxOptions: contentType === 'checkbox' ? checkboxOptions : undefined,
      radioOptions: contentType === 'radio' ? radioOptions : undefined,
      radioGroupName: contentType === 'radio' ? radioGroupName : undefined
    };

    onSave(updatedCell);
  };

  const handleCancel = () => {
    // 원래 값으로 되돌리기
    setContentType(cell.type || 'text');
    setTextContent(cell.content || '');
    setImageUrl(cell.imageUrl || '');
    setVideoUrl(cell.videoUrl || '');
    setCheckboxOptions(cell.checkboxOptions || []);
    setRadioOptions(cell.radioOptions || []);
    setRadioGroupName(cell.radioGroupName || '');
    onClose();
  };

  // YouTube URL을 임베드 URL로 변환
  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    return url;
  };

  // 이미지 URL 유효성 검사
  const isValidImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) || url.includes('data:image');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>셀 내용 편집</DialogTitle>
        </DialogHeader>

        <Tabs value={contentType} onValueChange={(value) => setContentType(value as 'text' | 'image' | 'video' | 'checkbox' | 'radio')}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              텍스트
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              이미지
            </TabsTrigger>
            <TabsTrigger value="video" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              동영상
            </TabsTrigger>
            <TabsTrigger value="checkbox" className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              체크박스
            </TabsTrigger>
            <TabsTrigger value="radio" className="flex items-center gap-2">
              <Circle className="w-4 h-4" />
              라디오
            </TabsTrigger>
          </TabsList>

          {/* 텍스트 탭 */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="text-content">텍스트 내용</Label>
              <Textarea
                id="text-content"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="셀에 표시할 텍스트를 입력하세요"
                rows={4}
              />
            </div>
            {textContent && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  <p className="whitespace-pre-wrap">{textContent}</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 이미지 탭 */}
          <TabsContent value="image" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">이미지 URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-sm text-gray-500">
                지원 형식: JPG, PNG, GIF, WebP, SVG
              </p>
            </div>
            {imageUrl && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  {isValidImageUrl(imageUrl) ? (
                    <img
                      src={imageUrl}
                      alt="이미지 미리보기"
                      className="max-w-full max-h-48 object-contain rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling!.textContent = '이미지를 불러올 수 없습니다.';
                      }}
                    />
                  ) : (
                    <p className="text-red-500 text-sm">올바른 이미지 URL을 입력해주세요.</p>
                  )}
                  <p className="text-red-500 text-sm hidden">이미지를 불러올 수 없습니다.</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 동영상 탭 */}
          <TabsContent value="video" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-url">동영상 URL</Label>
              <Input
                id="video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="text-sm text-gray-500">
                YouTube, Vimeo URL 또는 직접 동영상 링크를 입력하세요
              </p>
            </div>
            {videoUrl && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                    <div className="aspect-video">
                      <iframe
                        src={getYouTubeEmbedUrl(videoUrl)}
                        className="w-full h-full rounded"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.includes('vimeo.com') ? (
                    <div className="aspect-video">
                      <iframe
                        src={videoUrl.replace('vimeo.com/', 'player.vimeo.com/video/')}
                        className="w-full h-full rounded"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title="동영상 미리보기"
                      />
                    </div>
                  ) : videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video
                      src={videoUrl}
                      controls
                      className="w-full max-h-48 rounded"
                    >
                      동영상을 지원하지 않는 브라우저입니다.
                    </video>
                  ) : (
                    <p className="text-yellow-600 text-sm">
                      동영상 링크를 확인할 수 없습니다. YouTube, Vimeo 또는 직접 동영상 링크인지 확인해주세요.
                    </p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 체크박스 탭 */}
          <TabsContent value="checkbox" className="space-y-4">
            <div className="space-y-2">
              <Label>체크박스 옵션 관리</Label>
              <div className="space-y-3">
                {checkboxOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-3 border rounded-md">
                    <input
                      type="checkbox"
                      checked={option.checked || false}
                      onChange={(e) => {
                        const updated = [...checkboxOptions];
                        updated[index] = { ...option, checked: e.target.checked };
                        setCheckboxOptions(updated);
                      }}
                      className="rounded"
                    />
                    <Input
                      value={option.label}
                      onChange={(e) => {
                        const updated = [...checkboxOptions];
                        updated[index] = { ...option, label: e.target.value };
                        setCheckboxOptions(updated);
                      }}
                      placeholder="옵션 텍스트"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCheckboxOptions(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: CheckboxOption = {
                    id: `checkbox-${Date.now()}`,
                    label: '새 옵션',
                    value: `option-${checkboxOptions.length + 1}`,
                    checked: false
                  };
                  setCheckboxOptions(prev => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>
            </div>
            {checkboxOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  <div className="space-y-2">
                    {checkboxOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={option.checked || false}
                          readOnly
                          className="rounded"
                        />
                        <span className="text-sm">{option.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 라디오 버튼 탭 */}
          <TabsContent value="radio" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="radio-group-name">라디오 그룹명</Label>
              <Input
                id="radio-group-name"
                value={radioGroupName}
                onChange={(e) => setRadioGroupName(e.target.value)}
                placeholder="라디오 버튼 그룹명 (예: payment-type)"
              />
            </div>
            <div className="space-y-2">
              <Label>라디오 버튼 옵션 관리</Label>
              <div className="space-y-3">
                {radioOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 p-3 border rounded-md">
                    <input
                      type="radio"
                      name="preview-radio"
                      checked={option.selected || false}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const updated = radioOptions.map((opt, i) => ({
                            ...opt,
                            selected: i === index
                          }));
                          setRadioOptions(updated);
                        }
                      }}
                    />
                    <Input
                      value={option.label}
                      onChange={(e) => {
                        const updated = [...radioOptions];
                        updated[index] = { ...option, label: e.target.value };
                        setRadioOptions(updated);
                      }}
                      placeholder="옵션 텍스트"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRadioOptions(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const newOption: RadioOption = {
                    id: `radio-${Date.now()}`,
                    label: '새 옵션',
                    value: `option-${radioOptions.length + 1}`,
                    selected: false
                  };
                  setRadioOptions(prev => [...prev, newOption]);
                }}
                className="w-full"
              >
                옵션 추가
              </Button>
            </div>
            {radioOptions.length > 0 && (
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border rounded-md bg-gray-50">
                  <div className="space-y-2">
                    {radioOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="preview-radio-display"
                          checked={option.selected || false}
                          readOnly
                        />
                        <span className="text-sm">{option.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}