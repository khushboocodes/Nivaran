import { Link } from 'react-router-dom';
import { Bot, TrendingUp, ArrowRight, Check, CheckCircle2, BarChart3, Shield, Zap, Globe, FileText, Lock, Calendar, MapPin, User, Users, AlertCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

const chartData = [
  { id: 1, day: 'Mon', value: 3 },
  { id: 2, day: 'Tue', value: 4 },
  { id: 3, day: 'Wed', value: 2 },
  { id: 4, day: 'Thu', value: 5 },
  { id: 5, day: 'Fri', value: 3 },
  { id: 6, day: 'Sat', value: 4 },
  { id: 7, day: 'Sun', value: 1 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="font-bold text-[#0F172A]">NIVARAN</span>
              </div>
              <Badge variant="secondary" className="bg-[#DBEAFE] text-[#1D4ED8] hover:bg-[#DBEAFE] border-0 text-xs px-2 py-0.5">
                <Bot className="w-3 h-3 mr-1" />
                AI POWERED
              </Badge>
            </div>

            {/* Center Nav */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-[#64748B] hover:text-[#0F172A]">Features</a>
              <a href="#analytics" className="text-sm text-[#64748B] hover:text-[#0F172A]">Analytics</a>
              <a href="#security" className="text-sm text-[#64748B] hover:text-[#0F172A]">Security</a>
            </div>

            {/* Right CTAs */}
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-[#0F172A] text-sm h-8">Citizen Portal</Button>
              </Link>
              <Link to="/admin/login">
                <Button size="sm" className="bg-[#1D4ED8] hover:bg-[#1e40af] text-sm h-8">Admin Console</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#F9FAFB] to-[#F8FAFC]">
        {/* Enhanced grid background with radial glow */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_50%,rgba(59,130,246,0.06),transparent_70%)]" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 relative">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left Content */}
            <div className="space-y-4 pt-6">
              <Badge variant="secondary" className="bg-white border border-[#E5E7EB] text-xs shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mr-2 animate-pulse" />
                Live — 143 complaints resolved today
              </Badge>

              <h1 className="text-[56px] font-extrabold text-[#0F172A] leading-[1.05] tracking-tight">
                AI-Powered<br />
                <span className="text-[#1D4ED8]">Citizen Governance</span><br />
                Intelligence Suite
              </h1>

              <p className="text-sm text-[#64748B] leading-relaxed max-w-md">
                NIVARAN automates complaint classification, routing, escalation, and resolution — giving governments real-time intelligence on civic issues at scale.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="bg-white border-[#E5E7EB] text-xs px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-[#22C55E]" strokeWidth={2} />
                  94.2% AI Accuracy
                </Badge>
                <Badge variant="outline" className="bg-white border-[#E5E7EB] text-xs px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-[#22C55E]" strokeWidth={2} />
                  Auto-Escalation
                </Badge>
                <Badge variant="outline" className="bg-white border-[#E5E7EB] text-xs px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-[#22C55E]" strokeWidth={2} />
                  11 Languages
                </Badge>
                <Badge variant="outline" className="bg-white border-[#E5E7EB] text-xs px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-[#22C55E]" strokeWidth={2} />
                  Audit-Ready
                </Badge>
              </div>

              <div className="flex gap-3 pt-2">
                <Link to="/login">
                  <Button className="bg-[#1D4ED8] hover:bg-[#1e40af] shadow-md h-9 px-4 text-sm">
                    File a Complaint
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button variant="outline" className="border-[#E5E7EB] bg-white h-9 px-4 text-sm shadow-sm hover:bg-[#F9FAFB]">
                    View Admin Console
                  </Button>
                </Link>
              </div>

              {/* Trusted Cities */}
              <div className="pt-4">
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-2">Trusted by smart cities</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="bg-white border-[#E5E7EB] text-[#64748B] text-[11px] px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] font-medium">Municipal Corp. Delhi</Badge>
                  <Badge variant="outline" className="bg-white border-[#E5E7EB] text-[#64748B] text-[11px] px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] font-medium">Smart City Pune</Badge>
                  <Badge variant="outline" className="bg-white border-[#E5E7EB] text-[#64748B] text-[11px] px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] font-medium">BBMP Bangalore</Badge>
                  <Badge variant="outline" className="bg-white border-[#E5E7EB] text-[#64748B] text-[11px] px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] font-medium">Chennai Corp.</Badge>
                  <Badge variant="outline" className="bg-white border-[#E5E7EB] text-[#64748B] text-[11px] px-2.5 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] font-medium">Hyderabad Metro</Badge>
                </div>
              </div>
            </div>

            {/* Right: Enhanced Realistic Dashboard */}
            <div className="relative">
              {/* Main Dashboard Window */}
              <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] overflow-hidden">
                {/* Window Chrome */}
                <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                  </div>
                  <div className="text-[10px] font-medium text-[#64748B]">NIVARAN Admin Dashboard</div>
                  <div className="w-12" />
                </div>

                <div className="p-3 space-y-2.5">
                  {/* Top Metrics Bar */}
                  <div className="flex items-center divide-x divide-[#E2E8F0] bg-[#F8FAFC] rounded-lg overflow-hidden">
                    <div className="flex-1 px-3 py-2.5 text-center">
                      <div className="text-xl font-bold text-[#0F172A]">2,641</div>
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Total</div>
                    </div>
                    <div className="flex-1 px-3 py-2.5 text-center">
                      <div className="text-xl font-bold text-[#F59E0B]">366</div>
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Pending</div>
                    </div>
                    <div className="flex-1 px-3 py-2.5 text-center">
                      <div className="text-xl font-bold text-[#16A34A]">2,247</div>
                      <div className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold">Resolved</div>
                    </div>
                  </div>

                  {/* Weekly Chart Section */}
                  <div className="bg-white border border-[#E2E8F0] rounded-lg p-2.5">
                    <div className="text-[10px] font-semibold text-[#0F172A] mb-2 uppercase tracking-wide">Weekly Complaint Volume</div>
                    <ResponsiveContainer width="100%" height={70}>
                      <BarChart data={chartData} key="landing-chart">
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 8, fill: '#94A3B8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Bar
                          dataKey="value"
                          fill="#3B82F6"
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={false}
                          name="complaints"
                          id="landing-bar"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Complaint Feed */}
                  <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
                    <div className="px-2.5 py-1.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="text-[9px] font-semibold text-[#0F172A] uppercase tracking-wide">Recent Complaints</div>
                    </div>
                    <div className="divide-y divide-[#E2E8F0]">
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-1 h-1 rounded-full bg-[#3B82F6] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-[#0F172A] truncate">Water pipeline leakage — Sector 14</div>
                            <div className="text-[8px] text-[#94A3B8]">Public Works • 2h ago</div>
                          </div>
                        </div>
                        <Badge className="bg-[#DBEAFE] text-[#3B82F6] text-[8px] px-1.5 py-0 ml-2 flex-shrink-0 hover:bg-[#DBEAFE] border-0">In Progress</Badge>
                      </div>
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-1 h-1 rounded-full bg-[#8B5CF6] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-[#0F172A] truncate">Street light outage — MG Road</div>
                            <div className="text-[8px] text-[#94A3B8]">Electricity • 4h ago</div>
                          </div>
                        </div>
                        <Badge className="bg-[#EDE9FE] text-[#8B5CF6] text-[8px] px-1.5 py-0 ml-2 flex-shrink-0 hover:bg-[#EDE9FE] border-0">Assigned</Badge>
                      </div>
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-1 h-1 rounded-full bg-[#EF4444] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-[#0F172A] truncate">Open manhole near school — Ward 7</div>
                            <div className="text-[8px] text-[#94A3B8]">Safety • 30m ago</div>
                          </div>
                        </div>
                        <Badge className="bg-[#FEE2E2] text-[#EF4444] text-[8px] px-1.5 py-0 ml-2 flex-shrink-0 hover:bg-[#FEE2E2] border-0">Escalated</Badge>
                      </div>
                      <div className="px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-1 h-1 rounded-full bg-[#F59E0B] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-[#0F172A] truncate">Garbage collection delay — Sector 9</div>
                            <div className="text-[8px] text-[#94A3B8]">Sanitation • 5h ago</div>
                          </div>
                        </div>
                        <Badge className="bg-[#FEF3C7] text-[#F59E0B] text-[8px] px-1.5 py-0 ml-2 flex-shrink-0 hover:bg-[#FEF3C7] border-0">Under Review</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating AI Confidence Widget */}
              <div className="absolute -top-3 -right-3 bg-white shadow-xl rounded-lg border border-[#E2E8F0] p-3 w-36 backdrop-blur-sm animate-[float_4s_ease-in-out_infinite]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wide">AI Confidence</div>
                  <Bot className="w-4 h-4 text-[#1D4ED8]" />
                </div>
                <div className="text-2xl font-bold text-[#1D4ED8] mb-1">94.2%</div>
                <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 mb-1.5">
                  <div className="bg-[#1D4ED8] h-1.5 rounded-full" style={{ width: '94.2%' }} />
                </div>
                <div className="flex items-center justify-between text-[8px]">
                  <span className="text-[#64748B]">Classification</span>
                  <span className="text-[#22C55E] flex items-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" />
                    +2.1%
                  </span>
                </div>
              </div>

              {/* Floating Critical Alerts Widget */}
              <div className="absolute -bottom-4 -left-3 bg-white shadow-xl rounded-lg border border-[#E2E8F0] p-2.5 w-40 backdrop-blur-sm animate-[float_3.5s_ease-in-out_infinite_0.5s]">
                <div className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wide mb-2">Critical Alerts</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#0F172A]">Water Supply</span>
                    <span className="text-[9px] font-semibold text-[#EF4444]">Critical</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#0F172A]">Sanitation</span>
                    <span className="text-[9px] font-semibold text-[#F59E0B]">High</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#0F172A]">Roads</span>
                    <span className="text-[9px] font-semibold text-[#F59E0B]">High</span>
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes float {
                  0%, 100% {
                    transform: translateY(0px);
                  }
                  50% {
                    transform: translateY(-6px);
                  }
                }
              `}</style>
            </div>
          </div>
        </div>
      </section>

      {/* Compact Metrics Strip */}
      <section className="bg-white border-y border-[#E2E8F0] mt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#0F172A] mb-1">12,847</div>
              <div className="text-xs text-[#64748B] mb-1.5">Complaints Resolved</div>
              <div className="text-xs text-[#22C55E] flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +18% this month
              </div>
            </div>

            <div className="text-center border-l border-[#E2E8F0]">
              <div className="text-3xl font-bold text-[#0F172A] mb-1">94.2%</div>
              <div className="text-xs text-[#64748B] mb-1.5">AI Routing Accuracy</div>
              <div className="text-xs text-[#22C55E] flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +2.1% vs last quarter
              </div>
            </div>

            <div className="text-center border-l border-[#E2E8F0]">
              <div className="text-3xl font-bold text-[#0F172A] mb-1">3.2 days</div>
              <div className="text-xs text-[#64748B] mb-1.5">Avg Resolution Time</div>
              <div className="text-xs text-[#22C55E] flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                -0.8 days vs Q3
              </div>
            </div>

            <div className="text-center border-l border-[#E2E8F0]">
              <div className="text-3xl font-bold text-[#0F172A] mb-1">45,231</div>
              <div className="text-xs text-[#64748B] mb-1.5">Active Citizens</div>
              <div className="text-xs text-[#22C55E] flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +2,300 this week
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Capabilities - Compact 3x2 Grid */}
      <section id="features" className="py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="mb-10">
            <div className="text-xs text-[#1D4ED8] font-semibold mb-2 uppercase tracking-wide">PLATFORM CAPABILITIES</div>
            <h2 className="text-3xl font-bold text-[#0F172A]">
              Everything a smart city needs to<br />govern effectively
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature Cards with Dark Icon Containers */}
            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#DBEAFE] text-[#1D4ED8] text-[10px] px-2 py-0.5 hover:bg-[#DBEAFE] border-0">Core AI</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">AI Complaint Classification</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                LLM-powered engine auto-routes complaints to the right department with 94.2% accuracy. Supports 11 Indian languages.
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#DBEAFE] text-[#1D4ED8] text-[10px] px-2 py-0.5 hover:bg-[#DBEAFE] border-0">Analytics</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">Real-Time Governance Analytics</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Live KPI dashboards, complaint heatmaps, department performance metrics, and SLA breach alerts.
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#FEF3C7] text-[#F59E0B] text-[10px] px-2 py-0.5 hover:bg-[#FEF3C7] border-0">Automation</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">Smart Auto-Escalation</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Critical or overdue complaints auto-escalate to senior officials. Zero-miss guarantee with configurable SLA rules.
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#FEF3C7] text-[#F59E0B] text-[10px] px-2 py-0.5 hover:bg-[#FEF3C7] border-0">Accessibility</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">Multilingual Citizen Interface</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                File complaints in Hindi, English, Tamil, Telugu, Hinglish and 7 more languages — fully accessible.
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#FEE2E2] text-[#EF4444] text-[10px] px-2 py-0.5 hover:bg-[#FEE2E2] border-0">Reports</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">Audit-Ready Reports</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Auto-generated department-wise, category-wise, and SLA compliance reports exportable as PDFs.
              </p>
            </div>

            <div className="group bg-white rounded-xl border border-[#E5E7EB] p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F172A] group-hover:bg-[#1D4ED8] flex items-center justify-center transition-colors duration-300">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-[#F3F4F6] text-[#64748B] text-[10px] px-2 py-0.5 hover:bg-[#F3F4F6] border-0">Security</Badge>
              </div>
              <h3 className="font-semibold text-[#0F172A] mb-2 text-base">Enterprise Security</h3>
              <p className="text-sm text-[#64748B] leading-relaxed">
                Role-based access, encrypted data at rest and in transit, full audit trail for every action.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Compact Blue Layout */}
      <section className="bg-gradient-to-r from-[#1D4ED8] to-[#1e40af] py-14">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs text-white/80 font-semibold mb-3 uppercase tracking-wide">GET STARTED</div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Deploy AI governance in your city<br />in 48 hours
              </h2>
              <p className="text-base text-white/90 mb-6 max-w-md leading-relaxed">
                NIVARAN is used by smart city programs, municipal corporations, and civic tech teams to cut complaint resolution time by 68%.
              </p>
              <div className="flex gap-3">
                <Link to="/citizen/dashboard">
                  <Button size="lg" className="bg-white text-[#1D4ED8] hover:bg-white/90 h-11 px-6">
                    File a Complaint
                  </Button>
                </Link>
                <Link to="/admin/dashboard">
                  <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20 h-11 px-6">
                    View Admin Console
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex items-start gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm mb-0.5">AI-assisted complaint resolution</div>
                    <p className="text-sm text-white/80">94.2% routing accuracy across all categories</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex items-start gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm mb-0.5">SLA-enforced auto escalation</div>
                    <p className="text-sm text-white/80">Zero-miss guarantee for critical complaints</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex items-start gap-3 mb-1.5">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm mb-0.5">Trusted by 45,000+ citizens</div>
                    <p className="text-sm text-white/80">Used by 5 major smart city programs in India</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Dark Navy */}
      <footer className="bg-[#0F172A] text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="font-bold">NIVARAN</span>
              </div>
              <p className="text-xs text-white/60 mb-3 leading-relaxed">
                AI-powered citizen grievance management for modern governance systems.
              </p>
              <Badge className="bg-[#166534]/20 text-[#22C55E] border-[#22C55E]/30 text-xs px-2 py-1 hover:bg-[#166534]/20">
                <Shield className="w-3 h-3 mr-1" />
                ISO 27001 Certified
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-sm">Platform</h4>
              <ul className="space-y-2 text-xs text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Citizen Portal</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Admin Console</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AI Classification</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Analytics</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-sm">Governance</h4>
              <ul className="space-y-2 text-xs text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">SLA Compliance</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AI Governance</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Reports</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Escalation Rules</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-xs text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Support</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex items-center justify-between">
            <div className="text-xs text-white/50">
              © 2026 NIVARAN. All rights reserved.
            </div>
            <div className="text-xs text-white/50">
              Trusted by Smart Cities Across India
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
