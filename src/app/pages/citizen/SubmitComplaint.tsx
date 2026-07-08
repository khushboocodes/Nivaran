import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Camera, Video, Mic, Circle, Bot, Globe, CheckCircle2, Send, Loader2, Sparkles, MapPin, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import { apiClient, ApiError } from '../../../lib/api/client';
import { uploadComplaintAttachment } from '../../../lib/api/uploads';
import type { AttachmentKind } from '@nivaran/shared';
import { track } from '../../../lib/telemetry';
import { useTranslation } from 'react-i18next';

interface AIAnalysis {
  category: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';
  confidence: number;
  summary: string;
}

export default function SubmitComplaint() {
  const navigate = useNavigate();
  const { addComplaint } = useComplaints();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    language: 'en',
    location: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
  });

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Staged attachments — picked or recorded before submission, uploaded
  // to S3 immediately after the complaint row is created. We hold a
  // local preview URL so the citizen can review what they're attaching
  // and a clean way to drop one before submitting.
  type StagedAttachment = {
    id: string;
    kind: AttachmentKind;
    file: File;
    previewUrl: string;
  };
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // Hidden file inputs for the Photo / Video / Audio buttons.
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Live audio recording (MediaRecorder API — browser-native, no service).
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);

  const stageFile = (kind: AttachmentKind, file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      alert('Files must be 25 MB or smaller.');
      return;
    }
    setStaged((prev) => [
      ...prev,
      {
        id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        file,
        previewUrl: URL.createObjectURL(file),
      },
    ]);
  };

  const removeStaged = (id: string) => {
    setStaged((prev) => {
      const next = prev.filter((s) => s.id !== id);
      const removed = prev.find((s) => s.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handlePickPhoto = () => photoInputRef.current?.click();
  const handlePickVideo = () => videoInputRef.current?.click();
  const handlePickAudio = () => audioInputRef.current?.click();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile('photo', file);
    e.target.value = '';
  };
  const onVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile('video', file);
    e.target.value = '';
  };
  const onAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile('audio', file);
    e.target.value = '';
  };

  const startRecording = async () => {
    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      setRecordError('Audio recording is not supported in this browser.');
      return;
    }
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      // Pick the best codec the browser supports for the smallest file.
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext = (blob.type.split('/')[1] ?? 'webm').split(';')[0];
        const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
        stageFile('audio', file);
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : 'Could not start recording.';
      setRecordError(message);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    recorderRef.current = null;
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser does not support location access.');
      return;
    }
    setLocationError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          lat,
          lng,
          // Only auto-populate the visible string when the field is empty,
          // so we don't overwrite a careful manual address.
          location: prev.location.trim().length === 0 ? `${lat}, ${lng}` : prev.location,
        }));
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        const message =
          err.code === 1
            ? 'Location permission denied. You can still type an address.'
            : 'Could not read your location. Please try again or type an address.';
        setLocationError(message);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  const analyzeWithAI = async () => {
    if (!formData.description || formData.description.length < 10) {
      alert('Please write a more detailed description for AI analysis');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await apiClient.post<{
        category: string;
        department: string;
        priority: AIAnalysis['priority'];
        sentiment: AIAnalysis['sentiment'];
        confidence: number;
        summary: string;
        provider: 'openai' | 'heuristic';
        degraded?: boolean;
      }>('/ai/classify', {
        description: formData.description,
        language: formData.language || undefined,
        // Title is the strongest single signal; pass it through so the
        // server-side heuristic can weight it 2x.
        title: formData.title || undefined,
      });

      const analysis: AIAnalysis = {
        category: result.category,
        department: result.department,
        priority: result.priority,
        sentiment: result.sentiment,
        // The wire confidence is 0..1; the existing UI renders it as an
        // integer percentage in the Badge.
        confidence: Math.round((result.confidence ?? 0) * 100),
        summary: result.summary,
      };

      setAiAnalysis(analysis);

      // Mirror the previous auto-populate behaviour so the Category select
      // updates if the citizen left it blank.
      if (!formData.category) {
        setFormData((prev) => ({
          ...prev,
          category: analysis.category.toLowerCase().replace(/\s/g, '-'),
        }));
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Please sign in again to analyse your complaint.'
          : 'AI analysis is temporarily unavailable. Please try again.';
      alert(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || !formData.category) {
      alert('Please fill in all required fields');
      return;
    }

    if (!aiAnalysis) {
      alert('Please run AI analysis before submitting');
      return;
    }

    setIsSubmitting(true);

    // Add complaint to global state. The server stamps id/timestamps/AI fields.
    let complaint: Awaited<ReturnType<typeof addComplaint>>;
    try {
      complaint = await addComplaint({
        title: formData.title,
        description: formData.description,
        category: aiAnalysis.category,
        department: aiAnalysis.department,
        priority: aiAnalysis.priority,
        status: 'Submitted',
        sentiment: aiAnalysis.sentiment,
        aiConfidence: aiAnalysis.confidence,
        aiSummary: aiAnalysis.summary,
        location: formData.location,
        estimatedResolution: '3-5 business days',
        ...(formData.lat !== undefined && formData.lng !== undefined
          ? { lat: formData.lat, lng: formData.lng }
          : {}),
      } as Parameters<typeof addComplaint>[0]);
    } catch {
      setIsSubmitting(false);
      alert('Could not submit your complaint. Please try again.');
      return;
    }

    // Upload staged attachments now that we have a complaint id.
    if (staged.length > 0) {
      setUploadProgress({ done: 0, total: staged.length });
      let failed = 0;
      for (let i = 0; i < staged.length; i++) {
        const item = staged[i];
        try {
          await uploadComplaintAttachment({
            complaintId: complaint.id,
            kind: item.kind,
            file: item.file,
            filename: item.file.name,
          });
        } catch {
          failed += 1;
        }
        setUploadProgress({ done: i + 1, total: staged.length });
      }
      setUploadProgress(null);
      if (failed > 0) {
        // Don't block the submit — the complaint is in. Just let the citizen
        // know which files didn't make it so they can retry from details.
        alert(`Complaint submitted, but ${failed} attachment${failed > 1 ? 's' : ''} failed to upload.`);
      }
      // Free the object URLs we kept for previews.
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    }

    setIsSubmitting(false);

    track('complaint.submitted', {
      category: aiAnalysis.category,
      priority: aiAnalysis.priority,
      hasLocation: typeof formData.lat === 'number' && typeof formData.lng === 'number',
      attachments: staged.length,
    });

    // Show success message
    alert(`✅ Complaint submitted successfully!\n\nComplaint ID: ${complaint.id}\n\nYou will be redirected to the dashboard.`);

    // Reset form
    setFormData({
      title: '',
      description: '',
      category: '',
      language: 'en',
      location: '',
      lat: undefined,
      lng: undefined,
    });
    setAiAnalysis(null);
    setLocationError(null);
    setStaged([]);

    // Redirect to dashboard
    navigate('/citizen/dashboard');
  };

  return (
    <CitizenLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">CITIZEN PORTAL</div>
          <h1 className="text-3xl font-bold text-[#0B1220]">Submit Complaint</h1>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Form (2 columns) */}
          <div className="lg:col-span-2">
            <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Complaint Title */}
                <div>
                  <Label htmlFor="title" className="text-sm font-medium text-[#0B1220] mb-2 block">
                    Complaint Title
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter a brief title for your complaint"
                    className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-[#0B1220] mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={6}
                    placeholder="Describe your complaint in detail..."
                    className="border-[#E5E7EB] rounded-xl resize-none focus:ring-2 focus:ring-[#2952E3] focus:border-transparent"
                    required
                  />
                </div>

                {/* Category and Language Row */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium text-[#0B1220] mb-2 block">
                      Category
                    </Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full h-11 px-4 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] focus:ring-2 focus:ring-[#2952E3] focus:border-transparent text-sm"
                      required
                    >
                      <option value="">Select category</option>
                      <option value="water-supply">Water Supply</option>
                      <option value="electricity">Electricity</option>
                      <option value="roads-&-infrastructure">Roads & Infrastructure</option>
                      <option value="sanitation">Sanitation</option>
                      <option value="drainage">Drainage</option>
                      <option value="public-health">Public Health</option>
                      <option value="street-lights">Street Lights</option>
                      <option value="waste-management">Waste Management</option>
                      <option value="traffic">Traffic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="language" className="text-sm font-medium text-[#0B1220] mb-2 block">
                      Language
                    </Label>
                    <select
                      id="language"
                      value={formData.language}
                      onChange={handleInputChange}
                      className="w-full h-11 px-4 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] focus:ring-2 focus:ring-[#2952E3] focus:border-transparent text-sm"
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="ta">Tamil</option>
                      <option value="te">Telugu</option>
                      <option value="kn">Kannada</option>
                      <option value="ml">Malayalam</option>
                      <option value="mr">Marathi</option>
                      <option value="bn">Bengali</option>
                      <option value="gu">Gujarati</option>
                      <option value="pa">Punjabi</option>
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <Label htmlFor="location" className="text-sm font-medium text-[#0B1220] mb-2 block">
                    Location
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Enter location or address"
                      className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent flex-1"
                    />
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={isLocating}
                      className="flex items-center gap-2 px-4 h-11 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280] hover:bg-[#F1F5F9] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <MapPin className="w-4 h-4" strokeWidth={2} />
                      {isLocating ? 'Locating…' : 'Use my location'}
                    </button>
                  </div>
                  {locationError && <p className="text-xs text-[#EF4444] mt-1">{locationError}</p>}
                  {formData.lat !== undefined && formData.lng !== undefined && (
                    <p className="text-xs text-[#6B7280] mt-1">
                      Coordinates: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                    </p>
                  )}
                </div>

                {/* Attachment Buttons */}
                <div>
                  <Label className="text-sm font-medium text-[#0B1220] mb-3 block">Attachments</Label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePickPhoto}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#EEF2FF] text-[#2952E3] hover:bg-[#DBEAFE] transition-colors text-sm font-medium"
                    >
                      <Camera className="w-4 h-4" strokeWidth={2} />
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={handlePickVideo}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#EDE9FE] text-[#8B5CF6] hover:bg-[#DDD6FE] transition-colors text-sm font-medium"
                    >
                      <Video className="w-4 h-4" strokeWidth={2} />
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={handlePickAudio}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#DCFCE7] text-[#22C55E] hover:bg-[#BBF7D0] transition-colors text-sm font-medium"
                    >
                      <Mic className="w-4 h-4" strokeWidth={2} />
                      Audio
                    </button>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5E7EB] transition-colors text-sm font-medium ${
                        isRecording
                          ? 'bg-[#FEE2E2] text-[#EF4444] hover:bg-[#FECACA]'
                          : 'bg-[#F8FAFC] text-[#6B7280] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      <Circle
                        className={`w-4 h-4 ${isRecording ? 'fill-[#EF4444]' : ''}`}
                        strokeWidth={2}
                      />
                      {isRecording ? 'Stop' : 'Record'}
                    </button>
                  </div>

                  {recordError && (
                    <p className="text-xs text-[#EF4444] mt-2">{recordError}</p>
                  )}

                  {/* Hidden inputs powering the visible buttons. */}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onPhotoChange}
                    className="hidden"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={onVideoChange}
                    className="hidden"
                  />
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={onAudioChange}
                    className="hidden"
                  />

                  {/* Staged previews — only render when there's something to show. */}
                  {staged.length > 0 && (
                    <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {staged.map((s) => (
                        <li
                          key={s.id}
                          className="relative group rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden"
                        >
                          {s.kind === 'photo' && (
                            <img
                              src={s.previewUrl}
                              alt="Attachment preview"
                              className="w-full h-24 object-cover"
                            />
                          )}
                          {s.kind === 'video' && (
                            <video
                              src={s.previewUrl}
                              className="w-full h-24 object-cover"
                              muted
                              playsInline
                            />
                          )}
                          {s.kind === 'audio' && (
                            <div className="h-24 flex items-center justify-center px-3">
                              <audio src={s.previewUrl} controls className="w-full" />
                            </div>
                          )}
                          <div className="px-2 py-1 text-[10px] text-[#6B7280] flex items-center justify-between bg-white border-t border-[#E5E7EB]">
                            <span className="capitalize">{s.kind}</span>
                            <span>{formatBytes(s.file.size)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStaged(s.id)}
                            aria-label="Remove attachment"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-[#6B7280] hover:text-[#EF4444] flex items-center justify-center shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {uploadProgress && (
                    <p className="text-xs text-[#6B7280] mt-2">
                      Uploading attachment {uploadProgress.done + 1} of {uploadProgress.total}…
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || !aiAnalysis}
                  className="w-full h-12 bg-[#2952E3] hover:bg-[#1e3a8a] text-white rounded-xl font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" strokeWidth={2} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" strokeWidth={2} />
                      Submit Complaint
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </div>

          {/* Right: AI Analysis + Filing Tips (1 column) */}
          <div className="space-y-6">
            {/* AI Analysis Card */}
            <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-[#0B1220]">AI Analysis</h3>
              </div>

              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-12 h-12 text-[#8B5CF6] animate-spin mb-4" strokeWidth={2} />
                  <div className="text-sm text-[#0B1220] font-medium">Analyzing complaint...</div>
                  <div className="text-xs text-[#6B7280] mt-1">AI is processing your description</div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0]">
                    <span className="text-xs font-medium text-[#166534]">AI Confidence</span>
                    <Badge className="bg-[#22C55E] text-white hover:bg-[#22C55E]">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {aiAnalysis.confidence}%
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">Category</div>
                      <div className="text-sm font-medium text-[#0B1220]">{aiAnalysis.category}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">Department</div>
                      <div className="text-sm font-medium text-[#0B1220]">{aiAnalysis.department}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">Priority</div>
                      <Badge className={`${
                        aiAnalysis.priority === 'Critical' ? 'bg-[#EF4444]' :
                        aiAnalysis.priority === 'High' ? 'bg-[#F59E0B]' :
                        aiAnalysis.priority === 'Medium' ? 'bg-[#3B82F6]' :
                        'bg-[#6B7280]'
                      } text-white hover:bg-opacity-90`}>
                        {aiAnalysis.priority}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">Sentiment</div>
                      <div className="text-sm font-medium text-[#0B1220]">{aiAnalysis.sentiment}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1.5">AI Summary</div>
                      <div className="text-xs text-[#0B1220] leading-relaxed bg-[#F8FAFC] p-3 rounded-lg">
                        {aiAnalysis.summary}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 rounded-full bg-[#F8FAFC] flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-[#6B7280]" strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-[#0B1220] font-medium mb-1.5">
                      Write a description and click<br />"Analyze with AI"
                    </div>
                    <div className="text-xs text-[#6B7280] leading-relaxed">
                      AI will suggest category, priority,<br />and department
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={analyzeWithAI}
                disabled={isAnalyzing || !formData.description}
                variant="outline"
                className="w-full h-10 border-[#E5E7EB] text-[#2952E3] hover:bg-[#EEF2FF] rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 mr-2" strokeWidth={2} />
                    {aiAnalysis ? 'Re-analyze' : 'Analyze with AI'}
                  </>
                )}
              </Button>
            </Card>

            {/* Filing Tips Card */}
            <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#22C55E] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-[#0B1220]">Filing Tips</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm text-[#6B7280]">Be specific about the issue and its location</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm text-[#6B7280]">Attach photos or videos as evidence</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm text-[#6B7280]">Use AI analysis for accurate classification</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" strokeWidth={2} />
                  <span className="text-sm text-[#6B7280]">Submit in your preferred language</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}
