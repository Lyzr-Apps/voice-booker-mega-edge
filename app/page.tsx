'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FiMonitor, FiPhone, FiSettings, FiCalendar, FiPhoneCall, FiPhoneOff, FiSearch, FiDownload, FiStar, FiClock, FiTrendingUp, FiTrendingDown, FiActivity, FiUsers, FiArrowUp, FiArrowDown, FiChevronRight, FiFileText, FiEdit, FiTrash2, FiSave, FiPlus, FiX, FiCheck, FiAlertCircle, FiHeadphones } from 'react-icons/fi'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const VOICE_AGENT_ID = '698a04d20769219591839a10'

interface ActiveCall {
  id: string
  callerId: string
  callerName: string
  startTime: Date
  duration: number
  intent: string
  status: 'active' | 'on-hold' | 'transferring'
  roomType?: string
}

interface CompletedCall {
  id: string
  callerId: string
  callerName: string
  timestamp: Date
  duration: number
  intent: string
  outcome: 'booked' | 'inquiry_resolved' | 'escalated' | 'cancelled' | 'modified'
  satisfaction: number
  bookingRef?: string
  transcript: TranscriptEntry[]
}

interface TranscriptEntry {
  speaker: 'Caller' | 'Agent'
  text: string
  timestamp: string
  intent?: string
}

interface Reservation {
  id: string
  bookingRef: string
  guestName: string
  checkIn: Date
  checkOut: Date
  roomType: string
  status: 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled'
  source: 'voice' | 'web'
  totalAmount: number
  phone: string
  email: string
  specialRequests?: string
  guests: number
}

interface IntentResponse {
  intent: string
  response: string
}

interface EscalationRule {
  id: string
  condition: string
  action: string
  enabled: boolean
}

interface BusinessHour {
  day: string
  enabled: boolean
  start: string
  end: string
}

const glassCard = 'backdrop-blur-[24px] bg-card/65 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-2xl'

function generateTranscript(intent: string): TranscriptEntry[] {
  if (intent === 'Room Booking') {
    return [
      { speaker: 'Agent', text: 'Thank you for calling Grand Vista Hotel. How may I assist you today?', timestamp: '00:00' },
      { speaker: 'Caller', text: 'Hi, I would like to book a room for next weekend.', timestamp: '00:05' },
      { speaker: 'Agent', text: 'I would be happy to help you with that. Could you please let me know your preferred check-in and check-out dates?', timestamp: '00:09', intent: 'Room Booking' },
      { speaker: 'Caller', text: 'Check-in on February 14th, check-out on February 16th.', timestamp: '00:15' },
      { speaker: 'Agent', text: 'Perfect. We have several room types available. Our Deluxe King is $289 per night, the Ocean View Suite is $459, and our Standard Queen is $189. Which would you prefer?', timestamp: '00:20' },
      { speaker: 'Caller', text: 'The Deluxe King sounds great.', timestamp: '00:30' },
      { speaker: 'Agent', text: 'Excellent choice. I have reserved a Deluxe King room for February 14th to 16th, two nights at $289 per night. Your booking reference is GV-2024-0847. Is there anything else I can help with?', timestamp: '00:35' },
      { speaker: 'Caller', text: 'No, that is all. Thank you!', timestamp: '00:45' },
      { speaker: 'Agent', text: 'You are welcome. We look forward to welcoming you. Have a great day!', timestamp: '00:48' },
    ]
  }
  if (intent === 'Availability Check') {
    return [
      { speaker: 'Agent', text: 'Good afternoon, Grand Vista Hotel reservations. How can I help?', timestamp: '00:00' },
      { speaker: 'Caller', text: 'I wanted to check room availability for March 20th to 23rd.', timestamp: '00:04', intent: 'Availability Check' },
      { speaker: 'Agent', text: 'Let me look that up for you. For March 20th through 23rd, we have availability in our Standard Queen, Deluxe King, and one Ocean View Suite remaining.', timestamp: '00:10' },
      { speaker: 'Caller', text: 'What are the rates for those dates?', timestamp: '00:18' },
      { speaker: 'Agent', text: 'The Standard Queen is $179 per night, Deluxe King is $269, and the Ocean View Suite is $429 per night. All rates include breakfast.', timestamp: '00:22' },
      { speaker: 'Caller', text: 'Great, I will think about it and call back. Thanks!', timestamp: '00:30' },
      { speaker: 'Agent', text: 'Of course! Rates are subject to availability, so I recommend booking soon. Have a wonderful day.', timestamp: '00:34' },
    ]
  }
  if (intent === 'Booking Modification') {
    return [
      { speaker: 'Agent', text: 'Grand Vista Hotel, how may I assist you?', timestamp: '00:00' },
      { speaker: 'Caller', text: 'I need to modify my existing reservation. My booking reference is GV-2024-0712.', timestamp: '00:05', intent: 'Booking Modification' },
      { speaker: 'Agent', text: 'I have found your reservation, Mr. Patterson. You currently have a Standard Queen for February 10th to 12th. What changes would you like to make?', timestamp: '00:12' },
      { speaker: 'Caller', text: 'I need to extend my stay by one additional night, checking out on the 13th instead.', timestamp: '00:20' },
      { speaker: 'Agent', text: 'I can do that for you. The additional night will be at the same rate of $189. Your updated reservation is now February 10th through 13th, three nights total. Shall I send a confirmation email?', timestamp: '00:28' },
      { speaker: 'Caller', text: 'Yes please. Thank you for your help.', timestamp: '00:35' },
      { speaker: 'Agent', text: 'Done! The confirmation has been sent to your email on file. Have a great stay!', timestamp: '00:38' },
    ]
  }
  if (intent === 'Cancellation') {
    return [
      { speaker: 'Agent', text: 'Thank you for calling Grand Vista Hotel. How can I help you today?', timestamp: '00:00' },
      { speaker: 'Caller', text: 'I need to cancel my reservation. Reference number GV-2024-0698.', timestamp: '00:04', intent: 'Cancellation' },
      { speaker: 'Agent', text: 'I am sorry to hear that. Let me pull up your booking. I see a Deluxe King for February 22nd to 24th. Since this is more than 48 hours out, you qualify for a full refund. Shall I proceed?', timestamp: '00:12' },
      { speaker: 'Caller', text: 'Yes, please go ahead with the cancellation.', timestamp: '00:20' },
      { speaker: 'Agent', text: 'Your reservation has been cancelled and a full refund of $578 will be processed within 5-7 business days. Is there anything else I can help with?', timestamp: '00:25' },
      { speaker: 'Caller', text: 'No, that is everything. Thank you.', timestamp: '00:30' },
    ]
  }
  return [
    { speaker: 'Agent', text: 'Grand Vista Hotel, how may I help you?', timestamp: '00:00' },
    { speaker: 'Caller', text: 'I have a question about your hotel amenities and parking.', timestamp: '00:04', intent: 'General Inquiry' },
    { speaker: 'Agent', text: 'Of course! We offer complimentary valet parking, a rooftop pool, fitness center, spa, and two on-site restaurants. Is there anything specific you would like to know?', timestamp: '00:10' },
    { speaker: 'Caller', text: 'That sounds great. What are check-in and check-out times?', timestamp: '00:18' },
    { speaker: 'Agent', text: 'Check-in is at 3:00 PM and check-out is at 11:00 AM. Early check-in and late check-out are available upon request, subject to availability.', timestamp: '00:23' },
    { speaker: 'Caller', text: 'Perfect, thank you so much!', timestamp: '00:28' },
  ]
}

function generateActiveCalls(): ActiveCall[] {
  return [
    { id: 'ac-001', callerId: '+1 (555) 234-8901', callerName: 'Sarah Mitchell', startTime: new Date(Date.now() - 3 * 60000), duration: 180, intent: 'Room Booking', status: 'active', roomType: 'Deluxe King' },
    { id: 'ac-002', callerId: '+1 (555) 876-5432', callerName: 'James O\'Brien', startTime: new Date(Date.now() - 7 * 60000), duration: 420, intent: 'Booking Modification', status: 'active' },
    { id: 'ac-003', callerId: '+1 (555) 345-6789', callerName: 'Maria Garcia', startTime: new Date(Date.now() - 1.5 * 60000), duration: 90, intent: 'Availability Check', status: 'on-hold' },
    { id: 'ac-004', callerId: '+1 (555) 901-2345', callerName: 'Robert Chen', startTime: new Date(Date.now() - 12 * 60000), duration: 720, intent: 'Escalation - Complaint', status: 'transferring' },
  ]
}

function generateCompletedCalls(): CompletedCall[] {
  const intents = ['Room Booking', 'Availability Check', 'Booking Modification', 'Cancellation', 'General Inquiry']
  const outcomes: CompletedCall['outcome'][] = ['booked', 'inquiry_resolved', 'escalated', 'cancelled', 'modified']
  const names = ['Emily Watson', 'David Kim', 'Jessica Torres', 'Michael Brown', 'Amanda Liu', 'Chris Taylor', 'Sophia Patel', 'Daniel Nguyen', 'Laura Martinez', 'Kevin White', 'Rachel Green', 'Thomas Black', 'Nina Sharma', 'Alex Johnson', 'Megan Wilson', 'Ryan Clark', 'Hannah Lee', 'Brian Foster', 'Olivia Adams', 'Patrick Hall']

  return names.map((name, i) => {
    const intentIdx = i % intents.length
    const outcomeIdx = i % outcomes.length
    return {
      id: `cc-${String(i + 1).padStart(3, '0')}`,
      callerId: `+1 (555) ${String(100 + i * 37).padStart(3, '0')}-${String(1000 + i * 123).slice(0, 4)}`,
      callerName: name,
      timestamp: new Date(Date.now() - (i + 1) * 45 * 60000),
      duration: 60 + Math.floor(Math.random() * 540),
      intent: intents[intentIdx],
      outcome: outcomes[outcomeIdx],
      satisfaction: 3 + Math.floor(Math.random() * 3),
      bookingRef: outcomeIdx === 0 ? `GV-2024-${String(800 + i).padStart(4, '0')}` : undefined,
      transcript: generateTranscript(intents[intentIdx]),
    }
  })
}

function generateReservations(): Reservation[] {
  const data: Reservation[] = [
    { id: 'r-001', bookingRef: 'GV-2024-0847', guestName: 'Sarah Mitchell', checkIn: new Date(2025, 1, 14), checkOut: new Date(2025, 1, 16), roomType: 'Deluxe King', status: 'confirmed', source: 'voice', totalAmount: 578, phone: '+1 (555) 234-8901', email: 'sarah.m@email.com', guests: 2, specialRequests: 'High floor, anniversary package' },
    { id: 'r-002', bookingRef: 'GV-2024-0838', guestName: 'David Kim', checkIn: new Date(2025, 1, 18), checkOut: new Date(2025, 1, 21), roomType: 'Ocean View Suite', status: 'confirmed', source: 'voice', totalAmount: 1377, phone: '+1 (555) 137-1123', email: 'dkim@email.com', guests: 2 },
    { id: 'r-003', bookingRef: 'GV-2024-0825', guestName: 'Emily Watson', checkIn: new Date(2025, 1, 10), checkOut: new Date(2025, 1, 12), roomType: 'Standard Queen', status: 'checked_in', source: 'voice', totalAmount: 378, phone: '+1 (555) 100-1000', email: 'ewatson@email.com', guests: 1 },
    { id: 'r-004', bookingRef: 'GV-2024-0812', guestName: 'Michael Brown', checkIn: new Date(2025, 1, 8), checkOut: new Date(2025, 1, 10), roomType: 'Deluxe King', status: 'checked_out', source: 'web', totalAmount: 578, phone: '+1 (555) 211-1369', email: 'mbrown@email.com', guests: 2 },
    { id: 'r-005', bookingRef: 'GV-2024-0798', guestName: 'Amanda Liu', checkIn: new Date(2025, 1, 22), checkOut: new Date(2025, 1, 25), roomType: 'Presidential Suite', status: 'pending', source: 'voice', totalAmount: 2697, phone: '+1 (555) 285-1615', email: 'aliu@email.com', guests: 3, specialRequests: 'Airport transfer, champagne on arrival' },
    { id: 'r-006', bookingRef: 'GV-2024-0785', guestName: 'Chris Taylor', checkIn: new Date(2025, 1, 12), checkOut: new Date(2025, 1, 14), roomType: 'Standard Queen', status: 'confirmed', source: 'web', totalAmount: 358, phone: '+1 (555) 322-1861', email: 'ctaylor@email.com', guests: 1 },
    { id: 'r-007', bookingRef: 'GV-2024-0770', guestName: 'Jessica Torres', checkIn: new Date(2025, 1, 5), checkOut: new Date(2025, 1, 7), roomType: 'Deluxe King', status: 'cancelled', source: 'voice', totalAmount: 0, phone: '+1 (555) 174-1246', email: 'jtorres@email.com', guests: 2 },
    { id: 'r-008', bookingRef: 'GV-2024-0755', guestName: 'Daniel Nguyen', checkIn: new Date(2025, 1, 20), checkOut: new Date(2025, 1, 23), roomType: 'Ocean View Suite', status: 'confirmed', source: 'voice', totalAmount: 1287, phone: '+1 (555) 359-2107', email: 'dnguyen@email.com', guests: 2, specialRequests: 'Extra pillows' },
    { id: 'r-009', bookingRef: 'GV-2024-0740', guestName: 'Laura Martinez', checkIn: new Date(2025, 2, 1), checkOut: new Date(2025, 2, 4), roomType: 'Standard Queen', status: 'pending', source: 'voice', totalAmount: 567, phone: '+1 (555) 396-2353', email: 'lmartinez@email.com', guests: 1 },
    { id: 'r-010', bookingRef: 'GV-2024-0728', guestName: 'Kevin White', checkIn: new Date(2025, 1, 15), checkOut: new Date(2025, 1, 17), roomType: 'Deluxe King', status: 'confirmed', source: 'web', totalAmount: 578, phone: '+1 (555) 433-2599', email: 'kwhite@email.com', guests: 2 },
  ]
  return data
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config: Record<string, { label: string; className: string }> = {
    booked: { label: 'Booked', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    inquiry_resolved: { label: 'Resolved', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    escalated: { label: 'Escalated', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    modified: { label: 'Modified', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  }
  const c = config[outcome] || { label: outcome, className: 'bg-muted text-muted-foreground' }
  return <Badge variant="outline" className={cn('text-xs font-medium', c.className)}>{c.label}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'Confirmed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    checked_in: { label: 'Checked In', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    checked_out: { label: 'Checked Out', className: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  }
  const c = config[status] || { label: status, className: 'bg-muted text-muted-foreground' }
  return <Badge variant="outline" className={cn('text-xs font-medium', c.className)}>{c.label}</Badge>
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <FiStar key={star} className={cn('w-3 h-3', star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
      ))}
    </div>
  )
}

function StatCard({ title, value, trend, trendUp, icon: Icon, accent }: { title: string; value: string; trend: string; trendUp: boolean; icon: React.ElementType; accent: string }) {
  return (
    <Card className={cn(glassCard, 'overflow-hidden relative group hover:border-white/20 transition-all duration-300')}>
      <div className={cn('absolute top-0 left-0 right-0 h-[2px]', accent)} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('p-2.5 rounded-xl', accent.replace('bg-gradient-to-r', 'bg-gradient-to-br').replace('bg-', 'bg-').split(' ')[0] + '/10')}>
            <Icon className={cn('w-5 h-5', accent.includes('emerald') ? 'text-emerald-400' : accent.includes('blue') ? 'text-blue-400' : accent.includes('amber') ? 'text-amber-400' : 'text-purple-400')} />
          </div>
          <div className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full', trendUp ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
            {trendUp ? <FiTrendingUp className="w-3 h-3" /> : <FiTrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        </div>
        <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-1">{title}</div>
      </CardContent>
    </Card>
  )
}

export default function Home() {
  const [activeView, setActiveView] = useState<'dashboard' | 'history' | 'config' | 'reservations'>('dashboard')
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>(generateActiveCalls())
  const [completedCalls] = useState<CompletedCall[]>(generateCompletedCalls())
  const [reservations] = useState<Reservation[]>(generateReservations())
  const [isListening, setIsListening] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedTranscript, setSelectedTranscript] = useState<CompletedCall | null>(null)
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false)
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<CompletedCall | null>(null)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [historyFilter, setHistoryFilter] = useState({ search: '', outcome: 'all', intent: 'all' })
  const [sampleData, setSampleData] = useState(true)
  const [configTab, setConfigTab] = useState('greeting')
  const [greetingScript, setGreetingScript] = useState('Thank you for calling Grand Vista Hotel. How may I assist you with your reservation today?')
  const [intentResponses, setIntentResponses] = useState<IntentResponse[]>([
    { intent: 'Room Booking', response: 'I would be happy to help you make a reservation. Could you please provide your preferred check-in and check-out dates?' },
    { intent: 'Availability Check', response: 'Let me check our room availability for your requested dates. One moment please.' },
    { intent: 'Booking Modification', response: 'I can help you modify your existing reservation. Could you please provide your booking reference number?' },
    { intent: 'Cancellation', response: 'I understand you would like to cancel. Let me pull up your reservation to review the cancellation policy.' },
    { intent: 'General Inquiry', response: 'I would be happy to answer any questions about our hotel. What would you like to know?' },
  ])
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([
    { id: 'er-1', condition: 'Caller requests to speak with a manager', action: 'Transfer to Front Desk Manager', enabled: true },
    { id: 'er-2', condition: 'Complaint about room condition or service', action: 'Transfer to Guest Relations', enabled: true },
    { id: 'er-3', condition: 'Billing dispute over $500', action: 'Transfer to Finance Department', enabled: true },
    { id: 'er-4', condition: 'Agent unable to resolve after 3 attempts', action: 'Transfer to Senior Reservations Agent', enabled: false },
    { id: 'er-5', condition: 'VIP guest or loyalty member', action: 'Transfer to VIP Concierge', enabled: true },
  ])
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([
    { day: 'Monday', enabled: true, start: '06:00', end: '23:00' },
    { day: 'Tuesday', enabled: true, start: '06:00', end: '23:00' },
    { day: 'Wednesday', enabled: true, start: '06:00', end: '23:00' },
    { day: 'Thursday', enabled: true, start: '06:00', end: '23:00' },
    { day: 'Friday', enabled: true, start: '06:00', end: '00:00' },
    { day: 'Saturday', enabled: true, start: '07:00', end: '00:00' },
    { day: 'Sunday', enabled: true, start: '07:00', end: '22:00' },
  ])
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      if (isListening) {
        setActiveCalls(prev => prev.map(call => ({
          ...call,
          duration: call.duration + 1,
        })))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [isListening])

  const handleSaveConfig = useCallback(() => {
    setSavingConfig(true)
    setTimeout(() => {
      setSavingConfig(false)
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    }, 1500)
  }, [])

  const filteredCalls = completedCalls.filter(call => {
    if (historyFilter.search) {
      const s = historyFilter.search.toLowerCase()
      if (!call.callerName.toLowerCase().includes(s) && !call.callerId.includes(s) && !(call.bookingRef || '').toLowerCase().includes(s)) return false
    }
    if (historyFilter.outcome !== 'all' && call.outcome !== historyFilter.outcome) return false
    if (historyFilter.intent !== 'all' && call.intent !== historyFilter.intent) return false
    return true
  })

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: FiMonitor },
    { id: 'history' as const, label: 'Call History', icon: FiPhone },
    { id: 'config' as const, label: 'Configuration', icon: FiSettings },
    { id: 'reservations' as const, label: 'Reservations', icon: FiCalendar },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'linear-gradient(145deg, hsl(225, 50%, 8%) 0%, hsl(240, 45%, 10%) 35%, hsl(260, 40%, 12%) 65%, hsl(225, 45%, 8%) 100%)' }}>
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[hsl(225,50%,8%)]/80 backdrop-blur-[24px] border-r border-white/10 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FiHeadphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Hotel Voice</h1>
              <p className="text-xs text-muted-foreground">Support Center</p>
            </div>
          </div>
        </div>
        <Separator className="opacity-50" />
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveView(item.id)} className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200', activeView === item.id ? 'bg-primary/15 text-primary shadow-lg shadow-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-white/5')}>
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </button>
          ))}
        </nav>
        <Separator className="opacity-50" />
        <div className="p-4">
          <Card className={cn(glassCard, 'p-3')}>
            <div className="text-xs text-muted-foreground mb-2">Voice Agent</div>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-2 h-2 rounded-full', isListening ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
              <span className="text-xs font-medium">{isListening ? 'System Online' : 'System Offline'}</span>
            </div>
            <div className="text-[10px] text-muted-foreground/70 font-mono truncate">ID: {VOICE_AGENT_ID}</div>
          </Card>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 h-16 border-b border-white/10 bg-[hsl(225,50%,8%)]/40 backdrop-blur-[24px] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground">Sample Data</Label>
              <Switch id="sample-toggle" checked={sampleData} onCheckedChange={setSampleData} />
            </div>
            <Separator orientation="vertical" className="h-6 opacity-30" />
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', isListening ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
              <span className="text-sm text-muted-foreground">{isListening ? 'System Online' : 'System Offline'}</span>
            </div>
            <Separator orientation="vertical" className="h-6 opacity-30" />
            <div className="text-sm text-muted-foreground">
              {format(currentTime, 'MMM d, yyyy')} <span className="text-foreground font-medium ml-1">{format(currentTime, 'HH:mm:ss')}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-8">
            {/* DASHBOARD VIEW */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats Row */}
                {sampleData ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard title="Total Calls Today" value="147" trend="+12%" trendUp={true} icon={FiPhone} accent="bg-blue-500" />
                    <StatCard title="Avg Duration" value="4:32" trend="-8%" trendUp={true} icon={FiClock} accent="bg-emerald-500" />
                    <StatCard title="Booking Conversion" value="34.2%" trend="+5.1%" trendUp={true} icon={FiTrendingUp} accent="bg-amber-500" />
                    <StatCard title="Escalation Rate" value="8.7%" trend="-2.3%" trendUp={true} icon={FiAlertCircle} accent="bg-purple-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard title="Total Calls Today" value="0" trend="--" trendUp={true} icon={FiPhone} accent="bg-blue-500" />
                    <StatCard title="Avg Duration" value="0:00" trend="--" trendUp={true} icon={FiClock} accent="bg-emerald-500" />
                    <StatCard title="Booking Conversion" value="0%" trend="--" trendUp={true} icon={FiTrendingUp} accent="bg-amber-500" />
                    <StatCard title="Escalation Rate" value="0%" trend="--" trendUp={true} icon={FiAlertCircle} accent="bg-purple-500" />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Active Calls */}
                  <Card className={cn(glassCard, 'lg:col-span-3')}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold">Active Calls</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Currently connected voice sessions</CardDescription>
                        </div>
                        <Button size="sm" variant={isListening ? 'destructive' : 'default'} onClick={() => setIsListening(!isListening)} className="gap-2 rounded-xl">
                          {isListening ? <FiPhoneOff className="w-3.5 h-3.5" /> : <FiPhoneCall className="w-3.5 h-3.5" />}
                          {isListening ? 'Stop Listening' : 'Start Listening'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {sampleData && Array.isArray(activeCalls) && activeCalls.length > 0 ? (
                        <div className="space-y-3">
                          {activeCalls.map(call => (
                            <div key={call.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-200">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                  <FiUsers className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', call.status === 'active' ? 'bg-emerald-400 animate-pulse' : call.status === 'on-hold' ? 'bg-amber-400' : 'bg-blue-400')} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{call.callerName}</span>
                                  <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10">{call.status === 'active' ? 'Active' : call.status === 'on-hold' ? 'On Hold' : 'Transferring'}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{call.callerId}</div>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <FiActivity className="w-3 h-3 text-primary" />
                                  {call.intent}
                                </div>
                                <div className="text-sm font-mono font-medium text-foreground mt-0.5">{formatDuration(call.duration)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <FiPhoneCall className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No active calls</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Incoming calls will appear here when the system is listening.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Completions */}
                  <Card className={cn(glassCard, 'lg:col-span-2')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Recent Completions</CardTitle>
                      <CardDescription className="text-xs">Last completed voice interactions</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {sampleData ? (
                        <ScrollArea className="h-[380px]">
                          <div className="space-y-2 pr-2">
                            {completedCalls.slice(0, 10).map(call => (
                              <div key={call.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer" onClick={() => { setSelectedTranscript(call); setTranscriptDialogOpen(true) }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-sm font-medium truncate">{call.callerName}</span>
                                  <OutcomeBadge outcome={call.outcome} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">{format(call.timestamp, 'HH:mm')} - {formatDuration(call.duration)}</span>
                                  <StarRating rating={call.satisfaction} />
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="text-[10px] text-muted-foreground/70">{call.intent}</span>
                                  <button className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                                    <FiFileText className="w-3 h-3" />
                                    View Transcript
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <FiClock className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No completed calls yet</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Completed calls and their outcomes will appear here.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* CALL HISTORY VIEW */}
            {activeView === 'history' && (
              <div className="space-y-6">
                {/* Filters */}
                <Card className={cn(glassCard)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px] relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search by name, phone, or booking ref..." value={historyFilter.search} onChange={(e) => setHistoryFilter(prev => ({ ...prev, search: e.target.value }))} className="pl-10 bg-white/5 border-white/10 rounded-xl" />
                      </div>
                      <Select value={historyFilter.outcome} onValueChange={(v) => setHistoryFilter(prev => ({ ...prev, outcome: v }))}>
                        <SelectTrigger className="w-[160px] bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder="Outcome" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Outcomes</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                          <SelectItem value="inquiry_resolved">Resolved</SelectItem>
                          <SelectItem value="escalated">Escalated</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="modified">Modified</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={historyFilter.intent} onValueChange={(v) => setHistoryFilter(prev => ({ ...prev, intent: v }))}>
                        <SelectTrigger className="w-[180px] bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder="Intent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Intents</SelectItem>
                          <SelectItem value="Room Booking">Room Booking</SelectItem>
                          <SelectItem value="Availability Check">Availability Check</SelectItem>
                          <SelectItem value="Booking Modification">Modification</SelectItem>
                          <SelectItem value="Cancellation">Cancellation</SelectItem>
                          <SelectItem value="General Inquiry">General Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/10 hover:bg-white/5">
                        <FiDownload className="w-3.5 h-3.5" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Call Log Table */}
                  <Card className={cn(glassCard, 'lg:col-span-3')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Call Log</CardTitle>
                      <CardDescription className="text-xs">{sampleData ? `${filteredCalls.length} calls found` : 'Enable sample data to view call history'}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {sampleData ? (
                        <ScrollArea className="h-[520px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-xs text-muted-foreground font-medium">Time</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Caller</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Duration</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Intent</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Outcome</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Rating</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCalls.map(call => (
                                <TableRow key={call.id} className={cn('border-white/5 cursor-pointer transition-colors', selectedHistoryCall?.id === call.id ? 'bg-primary/10' : 'hover:bg-white/[0.03]')} onClick={() => setSelectedHistoryCall(call)}>
                                  <TableCell className="text-xs font-mono text-muted-foreground">{format(call.timestamp, 'HH:mm')}</TableCell>
                                  <TableCell>
                                    <div className="text-sm font-medium">{call.callerName}</div>
                                    <div className="text-[10px] text-muted-foreground">{call.callerId}</div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{formatDuration(call.duration)}</TableCell>
                                  <TableCell className="text-xs">{call.intent}</TableCell>
                                  <TableCell><OutcomeBadge outcome={call.outcome} /></TableCell>
                                  <TableCell><StarRating rating={call.satisfaction} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <FiPhone className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No call history available</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Toggle Sample Data to see example call records.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Transcript Panel */}
                  <Card className={cn(glassCard, 'lg:col-span-2')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Transcript</CardTitle>
                      <CardDescription className="text-xs">{selectedHistoryCall ? `${selectedHistoryCall.callerName} - ${selectedHistoryCall.intent}` : 'Select a call to view transcript'}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {selectedHistoryCall ? (
                        <ScrollArea className="h-[480px]">
                          <div className="space-y-3 pr-2">
                            {Array.isArray(selectedHistoryCall?.transcript) && selectedHistoryCall.transcript.map((entry, idx) => (
                              <div key={idx} className={cn('flex gap-3', entry.speaker === 'Agent' ? '' : 'flex-row-reverse')}>
                                <div className={cn('w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold', entry.speaker === 'Agent' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400')}>
                                  {entry.speaker === 'Agent' ? 'AI' : 'C'}
                                </div>
                                <div className={cn('flex-1 max-w-[85%]')}>
                                  <div className={cn('text-[10px] mb-1 flex items-center gap-2', entry.speaker === 'Agent' ? 'text-blue-400' : 'text-emerald-400 justify-end')}>
                                    <span>{entry.speaker}</span>
                                    <span className="text-muted-foreground/50">{entry.timestamp}</span>
                                    {entry.intent && <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/30 px-1.5 py-0">{entry.intent}</Badge>}
                                  </div>
                                  <div className={cn('text-sm p-3 rounded-xl', entry.speaker === 'Agent' ? 'bg-blue-500/10 border border-blue-500/10 rounded-tl-sm' : 'bg-white/5 border border-white/5 rounded-tr-sm')}>
                                    {entry.text}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <FiFileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No transcript selected</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Click on a call in the log to view its transcript.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* CONFIGURATION VIEW */}
            {activeView === 'config' && (
              <div className="space-y-6">
                <Card className={cn(glassCard)}>
                  <CardContent className="p-6">
                    <Tabs value={configTab} onValueChange={setConfigTab}>
                      <TabsList className="bg-white/5 rounded-xl mb-6">
                        <TabsTrigger value="greeting" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Greeting Script</TabsTrigger>
                        <TabsTrigger value="intents" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Intent Responses</TabsTrigger>
                        <TabsTrigger value="escalation" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Escalation Rules</TabsTrigger>
                        <TabsTrigger value="hours" className="rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Business Hours</TabsTrigger>
                      </TabsList>

                      {/* Greeting Script Tab */}
                      <TabsContent value="greeting" className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Welcome Message</Label>
                          <p className="text-xs text-muted-foreground mb-3">This is the first message callers hear when connecting to the voice agent.</p>
                          <Textarea value={greetingScript} onChange={(e) => setGreetingScript(e.target.value)} rows={4} className="bg-white/5 border-white/10 rounded-xl resize-none" />
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                          <div className="text-xs text-muted-foreground mb-2">Preview</div>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <FiHeadphones className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="text-sm text-foreground/80 italic">&ldquo;{greetingScript}&rdquo;</div>
                          </div>
                        </div>
                      </TabsContent>

                      {/* Intent Responses Tab */}
                      <TabsContent value="intents" className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium">Intent-Response Pairs</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Configure how the agent responds to different customer intents.</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {Array.isArray(intentResponses) && intentResponses.map((ir, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">{ir.intent}</Badge>
                              </div>
                              <Textarea value={ir.response} onChange={(e) => { const updated = [...intentResponses]; updated[idx] = { ...updated[idx], response: e.target.value }; setIntentResponses(updated) }} rows={2} className="bg-white/5 border-white/10 rounded-xl resize-none text-sm" />
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      {/* Escalation Rules Tab */}
                      <TabsContent value="escalation" className="space-y-4">
                        <div>
                          <p className="text-sm font-medium">Escalation Conditions</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Define when calls should be transferred to a human agent.</p>
                        </div>
                        <div className="space-y-3">
                          {Array.isArray(escalationRules) && escalationRules.map((rule) => (
                            <div key={rule.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                              <Switch checked={rule.enabled} onCheckedChange={(checked) => { setEscalationRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: checked } : r)) }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{rule.condition}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <FiChevronRight className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{rule.action}</span>
                                </div>
                              </div>
                              <Badge variant="outline" className={cn('text-xs', rule.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground')}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      {/* Business Hours Tab */}
                      <TabsContent value="hours" className="space-y-4">
                        <div>
                          <p className="text-sm font-medium">Operating Schedule</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Set when the voice agent is available to take calls.</p>
                        </div>
                        <div className="space-y-2">
                          {Array.isArray(businessHours) && businessHours.map((bh, idx) => (
                            <div key={bh.day} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                              <Switch checked={bh.enabled} onCheckedChange={(checked) => { const updated = [...businessHours]; updated[idx] = { ...updated[idx], enabled: checked }; setBusinessHours(updated) }} />
                              <div className="w-24 text-sm font-medium">{bh.day}</div>
                              {bh.enabled ? (
                                <div className="flex items-center gap-2">
                                  <Input type="time" value={bh.start} onChange={(e) => { const updated = [...businessHours]; updated[idx] = { ...updated[idx], start: e.target.value }; setBusinessHours(updated) }} className="w-32 bg-white/5 border-white/10 rounded-lg text-sm" />
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <Input type="time" value={bh.end} onChange={(e) => { const updated = [...businessHours]; updated[idx] = { ...updated[idx], end: e.target.value }; setBusinessHours(updated) }} className="w-32 bg-white/5 border-white/10 rounded-lg text-sm" />
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground/60">Closed</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <Separator className="my-6 opacity-30" />
                    <div className="flex items-center justify-end gap-3">
                      {configSaved && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                          <FiCheck className="w-4 h-4" />
                          Configuration saved successfully
                        </div>
                      )}
                      <Button onClick={handleSaveConfig} disabled={savingConfig} className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
                        {savingConfig ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <FiSave className="w-4 h-4" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* RESERVATIONS VIEW */}
            {activeView === 'reservations' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Reservations Table */}
                  <Card className={cn(glassCard, 'lg:col-span-3')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Reservations</CardTitle>
                      <CardDescription className="text-xs">{sampleData ? `${reservations.length} total reservations` : 'Enable sample data to view reservations'}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {sampleData ? (
                        <ScrollArea className="h-[560px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-xs text-muted-foreground font-medium">Ref</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Guest</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Dates</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Room</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Status</TableHead>
                                <TableHead className="text-xs text-muted-foreground font-medium">Source</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Array.isArray(reservations) && reservations.map(res => (
                                <TableRow key={res.id} className={cn('border-white/5 cursor-pointer transition-colors', selectedReservation?.id === res.id ? 'bg-primary/10' : 'hover:bg-white/[0.03]')} onClick={() => setSelectedReservation(res)}>
                                  <TableCell className="text-xs font-mono text-primary">{res.bookingRef}</TableCell>
                                  <TableCell className="text-sm font-medium">{res.guestName}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{format(res.checkIn, 'MMM d')} - {format(res.checkOut, 'MMM d')}</TableCell>
                                  <TableCell className="text-xs">{res.roomType}</TableCell>
                                  <TableCell><StatusBadge status={res.status} /></TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn('text-[10px]', res.source === 'voice' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>
                                      {res.source === 'voice' ? 'Voice' : 'Web'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <FiCalendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No reservations to display</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Toggle Sample Data to view example reservations.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Detail Sidebar */}
                  <Card className={cn(glassCard, 'lg:col-span-2')}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold">Booking Details</CardTitle>
                      <CardDescription className="text-xs">{selectedReservation ? selectedReservation.bookingRef : 'Select a reservation to view details'}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {selectedReservation ? (
                        <div className="space-y-5">
                          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                <FiUsers className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                <div className="text-base font-semibold">{selectedReservation.guestName}</div>
                                <div className="text-xs text-muted-foreground">{selectedReservation.guests} guest{selectedReservation.guests > 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Phone</div>
                                <div className="text-xs">{selectedReservation.phone}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Email</div>
                                <div className="text-xs truncate">{selectedReservation.email}</div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Check-in</div>
                              <div className="text-sm font-medium">{format(selectedReservation.checkIn, 'MMM d, yyyy')}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Check-out</div>
                              <div className="text-sm font-medium">{format(selectedReservation.checkOut, 'MMM d, yyyy')}</div>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Room Type</div>
                              <StatusBadge status={selectedReservation.status} />
                            </div>
                            <div className="text-sm font-medium">{selectedReservation.roomType}</div>
                          </div>

                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</div>
                              <div className="text-lg font-semibold text-foreground">${selectedReservation.totalAmount.toLocaleString()}</div>
                            </div>
                          </div>

                          {selectedReservation.specialRequests && (
                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Special Requests</div>
                              <div className="text-sm text-foreground/80">{selectedReservation.specialRequests}</div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" variant="outline" className="flex-1 gap-2 rounded-xl border-white/10 hover:bg-white/5">
                              <FiEdit className="w-3.5 h-3.5" />
                              Modify
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
                              <FiTrash2 className="w-3.5 h-3.5" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <FiCalendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">No reservation selected</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Click on a reservation to view its full details.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Transcript Dialog */}
      <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{selectedTranscript?.callerName} - Call Transcript</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedTranscript ? `${selectedTranscript.intent} | ${format(selectedTranscript.timestamp, 'MMM d, yyyy HH:mm')} | Duration: ${formatDuration(selectedTranscript.duration)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {selectedTranscript && <OutcomeBadge outcome={selectedTranscript.outcome} />}
            {selectedTranscript && <StarRating rating={selectedTranscript.satisfaction} />}
          </div>
          <Separator className="opacity-20" />
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-3 py-2">
              {selectedTranscript && Array.isArray(selectedTranscript?.transcript) && selectedTranscript.transcript.map((entry, idx) => (
                <div key={idx} className={cn('flex gap-3', entry.speaker === 'Agent' ? '' : 'flex-row-reverse')}>
                  <div className={cn('w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold', entry.speaker === 'Agent' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400')}>
                    {entry.speaker === 'Agent' ? 'AI' : 'C'}
                  </div>
                  <div className="flex-1 max-w-[80%]">
                    <div className={cn('text-[10px] mb-1 flex items-center gap-2', entry.speaker === 'Agent' ? 'text-blue-400' : 'text-emerald-400 justify-end')}>
                      <span>{entry.speaker}</span>
                      <span className="text-muted-foreground/50">{entry.timestamp}</span>
                      {entry.intent && <Badge variant="outline" className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/30 px-1.5 py-0">{entry.intent}</Badge>}
                    </div>
                    <div className={cn('text-sm p-3 rounded-xl', entry.speaker === 'Agent' ? 'bg-blue-500/10 border border-blue-500/10 rounded-tl-sm' : 'bg-white/5 border border-white/5 rounded-tr-sm')}>
                      {entry.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
