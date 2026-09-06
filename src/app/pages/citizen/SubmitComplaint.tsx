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
import { toMonoWav16k, blobToBase64 } from '../../../lib/audio/toWav';

interface AIAnalysis {
  category: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';
  confidence: number;
  summary: string;
}

/**
 * The category options, as one list rather than hand-written `<option>` tags.
 *
 * The select stores a slug (`water-supply`) while the AI and the server both
 * speak the display label (`Water Supply`). Those two vocabularies existed
 * before but nothing connected them, so filling the form from a voice
 * recording wrote "Water Supply" into a select whose values are slugs, matched
 * no option, and the dropdown silently fell back to "Select category" — the
 * citizen saw an empty required field and reasonably assumed the transcription
 * had failed. Keeping both forms side by side here means the mapping cannot
 * drift again.
 */
const CATEGORY_OPTIONS = [
  { value: 'water-supply', label: 'Water Supply' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'roads-&-infrastructure', label: 'Roads & Infrastructure' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'drainage', label: 'Drainage' },
  { value: 'public-health', label: 'Public Health' },
  { value: 'street-lights', label: 'Street Lights' },
  { value: 'waste-management', label: 'Waste Management' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Resolve whatever the AI returned into a value the select can actually show.
 *
 * Accepts a display label ("Street Lights"), a slug ("street-lights"), or
 * anything cased differently, because the model is prompted for a label but is
 * not constrained to one. Returns '' for an unrecognised category, which keeps
 * the field visibly empty rather than wedging an invalid value into a required
 * input.
 */
function toCategoryValue(input: string | null | undefined): string {
  if (!input) return '';
  const needle = input.trim().toLowerCase();
  const hit = CATEGORY_OPTIONS.find(
    (o) => o.label.toLowerCase() === needle || o.value.toLowerCase() === needle,
  );
  return hit?.value ?? '';
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

  // Voice intake. The recording is held so it can be transcribed on demand
  // rather than automatically: a citizen may want to attach audio as evidence
  // without having the form rewritten underneath them.
  const lastRecordingRef = useRef<Blob | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceResult, setVoiceResult] = useState<{
    transcript: string;
    detectedLanguage: string;
    englishText: string;
    modelName: string;
  } | null>(null);
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
        // Keep the raw blob so it can be transcribed. The staged File is for
        // upload as evidence; this is for the speech pipeline.
        lastRecordingRef.current = blob;
        setHasRecording(true);
        setVoiceError(null);
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

  /**
   * Transcribe the recording and fill the form from it.
   *
   * The recording is converted to 16 kHz mono WAV first. MediaRecorder produces
   * webm in Chrome and mp4 in Safari, and webm is not on Google's documented
   * list of accepted audio formats — converting removes that uncertainty rather
   * than discovering it in front of the user. See lib/audio/toWav.
   */
  const transcribeRecording = async () => {
    const blob = lastRecordingRef.current;
    if (!blob) return;

    setIsTranscribing(true);
    setVoiceError(null);
    try {
      const { blob: wav } = await toMonoWav16k(blob);
      const audioBase64 = await blobToBase64(wav);

      const res = await apiClient.post<{
        transcript: string;
        detectedLanguage: string;
        englishText: string;
        title: string;
        description: string;
        category: string;
        priority: 'Low' | 'Medium' | 'High' | 'Critical';
        sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';
        speechDetected: boolean;
        confidence: number;
        modelName: string;
      }>('/ai/voice', { audioBase64, mimeType: 'audio/wav' });

      if (!res.speechDetected) {
        setVoiceError(
          'No clear speech was found in that recording. Try again somewhere quieter, or type the complaint.',
        );
        return;
      }

      // Fill the form, but leave what the citizen already typed alone: an
      // accidental transcription must not destroy their own words.
      setFormData((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : res.title,
        description: prev.description.trim() ? prev.description : res.description,
        // Mapped to the select's own vocabulary, otherwise the label the model
        // returns matches no option and the field renders blank.
        category: prev.category || toCategoryValue(res.category),
        language: res.detectedLanguage || prev.language,
      }));

      setVoiceResult({
        transcript: res.transcript,
        detectedLanguage: res.detectedLanguage,
        englishText: res.englishText,
        modelName: res.modelName,
      });

      // The same call already classified the complaint, so show it rather than
      // making the citizen press "Analyze with AI" for information we have.
      setAiAnalysis({
        category: res.category,
        department: '',
        priority: res.priority,
        sentiment: res.sentiment,
        // This UI carries confidence as an integer percentage; the wire value is
        // 0..1. Same conversion the typed-complaint path does, so a dictated
        // complaint counts toward the dashboard's AI-accuracy figure exactly like
        // a typed one. Leaving it at 0 would have quietly excluded every voice
        // submission from that statistic.
        confidence: Math.round((res.confidence ?? 0) * 100),
        summary: res.englishText.slice(0, 240),
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 502
            ? 'The transcription service is unavailable right now. Please type the complaint instead.'
            : err.status === 413
              ? 'That recording is too long. Please record a shorter clip.'
              : 'Could not transcribe the recording. Please type the complaint instead.'
          : 'Could not read the recording in this browser. Please type the complaint instead.';
      setVoiceError(message);
    } finally {
      setIsTranscribing(false);
    }
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
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        // Turn the fix into a place name before writing it to the field.
        //
        // This is not cosmetic. The server resolves a complaint to a Census
        // district by matching district *names* in this text, so coordinates
        // alone resolve to nothing and the complaint never reaches the
        // district aggregates or the planning layer. Writing both means the
        // citizen can verify where the report is pinned, and the district is
        // recoverable from the same string.
        let label: string | null = null;
        try {
          const place = await apiClient.get<{ label: string | null }>('/geo/reverse', {
            query: { lat, lng },
          });
          label = place.label;
        } catch {
          // Geocoding is a convenience, never a gate on filing a complaint.
          label = null;
        }

        setFormData((prev) => ({
          ...prev,
          lat,
          lng,
          // Only auto-populate the visible string when the field is empty,
          // so we don't overwrite a careful manual address.
          location:
            prev.location.trim().length === 0
              ? label
                ? `${lat}, ${lng} - ${label}`
                : `${lat}, ${lng}`
              : prev.location,
        }));
        if (!label) {
          setLocationError(
            'Saved your exact coordinates, but could not look up the address. Add the area and district if you can.',
          );
        }
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
        detectedLanguage?: string;
        provider: 'gemini' | 'openai' | 'heuristic';
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

      // Auto-populate category if left blank, and set the Language field to
      // the language the AI detected the complaint was written in.
      const supportedLangs = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur'];
      const detected = result.detectedLanguage && supportedLangs.includes(result.detectedLanguage)
        ? result.detectedLanguage
        : null;
      setFormData((prev) => ({
        ...prev,
        // Was an inline slugify, which happened to work for the eight expected
        // labels and silently produced an unmatchable value for anything else.
        // toCategoryValue validates against the real option list instead.
        category: prev.category ? prev.category : toCategoryValue(analysis.category),
        language: detected ?? prev.language,
      }));
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
        // Voice provenance travels with the complaint so the citizen's own words
        // survive into the record rather than only the English translation.
        ...(voiceResult
          ? {
              sourceTranscript: voiceResult.transcript,
              sourceLanguage: voiceResult.detectedLanguage,
            }
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
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

                  {/* Voice intake. Offered rather than automatic: a citizen may
                      want to attach audio purely as evidence without having the
                      form rewritten underneath them. */}
                  {hasRecording && !isRecording && (
                    <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          onClick={() => void transcribeRecording()}
                          disabled={isTranscribing}
                          className="bg-[#0B1220] hover:bg-[#1D4ED8] text-white h-9"
                        >
                          {isTranscribing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-2" strokeWidth={2} />
                          )}
                          {isTranscribing ? 'Listening…' : 'Fill form from my recording'}
                        </Button>
                        <p className="text-xs text-[#6B7280]">
                          Speak in any Indian language. It will be transcribed, translated, and
                          categorised.
                        </p>
                      </div>

                      {voiceError && <p className="text-xs text-[#EF4444] mt-2">{voiceError}</p>}

                      {voiceResult && (
                        <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#EEF2FF] text-[#3730A3] hover:bg-[#EEF2FF] text-[10px]">
                              detected: {voiceResult.detectedLanguage}
                            </Badge>
                            <Badge className="bg-[#F1F5F9] text-[#475569] hover:bg-[#F1F5F9] text-[10px]">
                              {voiceResult.modelName}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">
                              What you said
                            </p>
                            <p className="text-sm text-[#0B1220] leading-relaxed">
                              {voiceResult.transcript}
                            </p>
                          </div>
                          {voiceResult.detectedLanguage !== 'en' && (
                            <div>
                              <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">
                                English translation
                              </p>
                              <p className="text-sm text-[#334155] leading-relaxed">
                                {voiceResult.englishText}
                              </p>
                            </div>
                          )}
                          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                            Your original words are kept with the complaint, so staff can check the
                            translation rather than rely on it.
                          </p>
                        </div>
                      )}
                    </div>
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
