import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:permission_handler/permission_handler.dart';
import '../../core/theme.dart';
import '../../models/group_meet.dart';
import '../../providers/group_meet_providers.dart';

class GroupMeetScreen extends ConsumerStatefulWidget {
  final String meetingId;
  final String? initialAction;
  const GroupMeetScreen({super.key, required this.meetingId, this.initialAction});
  @override ConsumerState<GroupMeetScreen> createState() => _GroupMeetScreenState();
}

class _GroupMeetScreenState extends ConsumerState<GroupMeetScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _busy = false;
  bool _actedFromPush = false;
  final _message = TextEditingController();
  @override void initState() { super.initState(); _tabs = TabController(length: 2, vsync: this); }
  @override void dispose() { _tabs.dispose(); _message.dispose(); super.dispose(); }

  Future<void> _respond(String action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try { await ref.read(groupMeetsServiceProvider).respond(widget.meetingId, action); ref.invalidate(groupMeetProvider(widget.meetingId)); }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not update your response'))); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _send() async { final body = _message.text.trim(); if (body.isEmpty) return; _message.clear(); await ref.read(groupMeetsServiceProvider).send(widget.meetingId, body); ref.invalidate(groupMeetProvider(widget.meetingId)); }

  Future<void> _join(GroupMeet meet) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final credentials = await ref.read(groupMeetsServiceProvider).join(widget.meetingId);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => _SquadUpCall(credentials: credentials)));
      await ref.read(groupMeetsServiceProvider).leave(widget.meetingId);
      ref.invalidate(groupMeetProvider(widget.meetingId));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not join SquadUp: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override Widget build(BuildContext context) {
    final value = ref.watch(groupMeetProvider(widget.meetingId));
    return value.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (_, _) => Scaffold(appBar: AppBar(title: const Text('Group Meet')), body: Center(child: FilledButton(onPressed: () => ref.invalidate(groupMeetProvider(widget.meetingId)), child: const Text('Try again')))),
      data: (meet) {
        final myRsvp = meet.selfRsvp;
        final action = widget.initialAction;
        if (!_actedFromPush && myRsvp == 'invited' && (action == 'accept' || action == 'decline')) { _actedFromPush = true; WidgetsBinding.instance.addPostFrameCallback((_) => _respond(action!)); }
        final needsResponse = myRsvp == 'invited' && meet.status != 'cancelled';
        return PopScope(
          canPop: !needsResponse,
          child: Scaffold(
            backgroundColor: AppColors.surface,
            appBar: AppBar(automaticallyImplyLeading: !needsResponse, title: const Text('Group Meet'), actions: [if (meet.status == 'rescheduled') const Padding(padding: EdgeInsets.only(right: 16), child: Chip(label: Text('Rescheduled')))]),
            body: Column(children: [
              Container(width: double.infinity, margin: const EdgeInsets.all(16), padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: const Color(0xFF201F35), borderRadius: BorderRadius.circular(20)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(meet.status == 'rescheduled' ? 'UPDATED INVITATION · VERSION ${meet.revision}' : 'GROUP INVITATION', style: const TextStyle(color: Color(0xFFFFFF99), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1)), const SizedBox(height: 8),
                Text(meet.title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)), const SizedBox(height: 14),
                Text(_formatWhen(meet.startsAt), style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)), const SizedBox(height: 3), Text('${meet.timezone} · ${meet.invitedCount} talents invited', style: const TextStyle(color: Colors.white60, fontSize: 12)),
                if (!needsResponse && myRsvp == 'accepted') ...[const SizedBox(height: 16), SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: _busy ? null : () => _join(meet), icon: const Icon(Icons.videocam_outlined), label: Text(_busy ? 'Joining…' : 'Join SquadUp'), style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFFFF99), foregroundColor: const Color(0xFF0A0A0A))))],
              ])),
              TabBar(controller: _tabs, tabs: const [Tab(text: 'People'), Tab(text: 'Messages')]),
              Expanded(child: TabBarView(controller: _tabs, children: [_People(meet.members), _Messages(meet: meet, controller: _message, onSend: _send)])),
            ]),
            bottomNavigationBar: needsResponse ? SafeArea(child: Container(padding: const EdgeInsets.fromLTRB(16, 12, 16, 12), decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.border))), child: Column(mainAxisSize: MainAxisSize.min, children: [const Text('Please respond before closing this invitation.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)), const SizedBox(height: 10), Row(children: [Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _respond('decline'), child: const Text('Decline'))), const SizedBox(width: 10), Expanded(child: FilledButton(onPressed: _busy ? null : () => _respond('accept'), child: Text(_busy ? 'Updating…' : 'Accept invite')))])]))) : null,
          ),
        );
      },
    );
  }
}

class _People extends StatelessWidget { final List<GroupMeetMember> members; const _People(this.members); @override Widget build(BuildContext context) { final ordered = [...members]..sort((a,b) => {'host':0,'team':1,'guest':2}[a.role]!.compareTo({'host':0,'team':1,'guest':2}[b.role]!)); return ListView.separated(padding: const EdgeInsets.all(16), itemCount: ordered.length, separatorBuilder: (_,_) => const Divider(height: 1), itemBuilder: (_,i) { final m=ordered[i]; final amount=m.agreedAmount?['amount']; return ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4), leading: CircleAvatar(backgroundColor: const Color(0xFFFFFAC2), foregroundColor: const Color(0xFF0A0A0A), child: Text(m.displayName.substring(0,1))), title: Text(m.displayName, style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(m.role=='host'?'Client · Host':m.role=='team'?'Sales · UpSquad':amount is num?'₹${NumberFormat.decimalPattern('en_IN').format(amount)} agreed':'Talent'), trailing: Text(m.rsvp == 'accepted' ? 'Accepted' : m.rsvp == 'declined' ? 'Declined' : 'Awaiting', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: m.rsvp == 'accepted' ? Colors.green.shade700 : AppColors.textSecondary))); }); } }
class _Messages extends StatelessWidget { final GroupMeet meet; final TextEditingController controller; final VoidCallback onSend; const _Messages({required this.meet, required this.controller, required this.onSend}); @override Widget build(BuildContext context) => Column(children:[Expanded(child:ListView.builder(padding:const EdgeInsets.all(16),itemCount:meet.messages.length,itemBuilder:(_,i){final m=meet.messages[i];if(m.senderType=='system')return Padding(padding:const EdgeInsets.all(10),child:Text(m.body,textAlign:TextAlign.center,style:const TextStyle(fontSize:11,color:AppColors.textMuted)));return Align(alignment:m.senderType=='talent'?Alignment.centerRight:Alignment.centerLeft,child:Container(margin:const EdgeInsets.only(bottom:10),padding:const EdgeInsets.symmetric(horizontal:14,vertical:10),decoration:BoxDecoration(color:m.senderType=='talent'?const Color(0xFF171717):Colors.white,borderRadius:BorderRadius.circular(16),border:m.senderType=='talent'?null:Border.all(color:AppColors.border)),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(m.senderName,style:TextStyle(fontSize:10,color:m.senderType=='talent'?Colors.white60:AppColors.textMuted)),const SizedBox(height:3),Text(m.body,style:TextStyle(color:m.senderType=='talent'?Colors.white:AppColors.textPrimary))]))); })),Container(color:Colors.white,padding:const EdgeInsets.all(12),child:Row(children:[Expanded(child:TextField(controller:controller,decoration:const InputDecoration(hintText:'Message everyone'))),IconButton.filled(onPressed:onSend,icon:const Icon(Icons.send))]))]); }

class _SquadUpCall extends StatefulWidget {
  final GroupMeetJoinCredentials credentials;
  const _SquadUpCall({required this.credentials});
  @override State<_SquadUpCall> createState() => _SquadUpCallState();
}

class _SquadUpCallState extends State<_SquadUpCall> {
  late final lk.Room _room;
  bool _connecting = true;
  bool _mic = true;
  bool _camera = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _room = lk.Room(roomOptions: const lk.RoomOptions(adaptiveStream: true, dynacast: true));
    _room.addListener(_changed);
    _connect();
  }

  Future<void> _connect() async {
    try {
      await [Permission.microphone, Permission.camera].request();
      await _room.connect(widget.credentials.url, widget.credentials.token);
      await _room.localParticipant?.setMicrophoneEnabled(true);
      if (mounted) setState(() => _connecting = false);
    } catch (error) {
      if (mounted) setState(() { _connecting = false; _error = error.toString(); });
    }
  }

  void _changed() { if (mounted) setState(() {}); }

  Future<void> _toggleMic() async {
    _mic = !_mic;
    await _room.localParticipant?.setMicrophoneEnabled(_mic);
    if (mounted) setState(() {});
  }

  Future<void> _toggleCamera() async {
    _camera = !_camera;
    await _room.localParticipant?.setCameraEnabled(_camera);
    if (mounted) setState(() {});
  }

  Future<void> _leave() async {
    await _room.disconnect();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _room.removeListener(_changed);
    _room.disconnect();
    _room.dispose();
    super.dispose();
  }

  List<lk.Participant> get _participants => [
    if (_room.localParticipant != null) _room.localParticipant!,
    ..._room.remoteParticipants.values,
  ];

  @override
  Widget build(BuildContext context) {
    if (_connecting) return const Scaffold(backgroundColor: Color(0xFF111214), body: Center(child: CircularProgressIndicator(color: Color(0xFFFFFF99))));
    if (_error != null) return Scaffold(backgroundColor: const Color(0xFF111214), body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.videocam_off_outlined, color: Color(0xFFFFFF99), size: 42), const SizedBox(height: 14), Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)), const SizedBox(height: 16), FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Back'))]))));
    final participants = _participants;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF111214),
        appBar: AppBar(
          automaticallyImplyLeading: false,
          backgroundColor: const Color(0xFF111214),
          foregroundColor: Colors.white,
          title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(widget.credentials.meeting.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)), Text('${participants.length} in SquadUp', style: const TextStyle(fontSize: 11, color: Colors.white60))]),
          actions: [Padding(padding: const EdgeInsets.only(right: 14), child: Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: const Color(0xFFFFFF99), borderRadius: BorderRadius.circular(20)), child: const Text('LIVE', style: TextStyle(color: Color(0xFF0A0A0A), fontSize: 10, fontWeight: FontWeight.w800)))))],
        ),
        body: GridView.builder(
          padding: const EdgeInsets.all(10),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: participants.length <= 1 ? 1 : 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: .82),
          itemCount: participants.length,
          itemBuilder: (_, index) => _ParticipantTile(participant: participants[index]),
        ),
        bottomNavigationBar: SafeArea(child: Container(color: const Color(0xFF111214), padding: const EdgeInsets.fromLTRB(16, 10, 16, 14), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _CallControl(icon: _mic ? Icons.mic : Icons.mic_off, active: _mic, onTap: _toggleMic),
          const SizedBox(width: 12),
          _CallControl(icon: _camera ? Icons.videocam : Icons.videocam_off, active: _camera, onTap: _toggleCamera),
          const SizedBox(width: 12),
          _CallControl(icon: Icons.people_outline, onTap: () => _showPeople(context)),
          const SizedBox(width: 12),
          _CallControl(icon: Icons.call_end, danger: true, onTap: _leave),
        ]))),
      ),
    );
  }

  void _showPeople(BuildContext context) {
    showModalBottomSheet<void>(context: context, showDragHandle: true, builder: (_) => SafeArea(child: SizedBox(height: 360, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Padding(padding: EdgeInsets.fromLTRB(20, 8, 20, 10), child: Text('People in SquadUp', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))), Expanded(child: ListView(children: _participants.map((participant) => ListTile(leading: CircleAvatar(backgroundColor: const Color(0xFFFFFAC2), child: Text((participant.name.isNotEmpty ? participant.name : participant.identity).substring(0, 1).toUpperCase())), title: Text(participant.name.isNotEmpty ? participant.name : participant.identity), subtitle: Text(participant is lk.LocalParticipant ? 'You' : 'Connected'), trailing: participant.isSpeaking ? const Icon(Icons.graphic_eq, color: Colors.green) : null)).toList()))]))));
  }
}

class _ParticipantTile extends StatelessWidget {
  final lk.Participant participant;
  const _ParticipantTile({required this.participant});
  lk.VideoTrack? get _video {
    for (final publication in participant.videoTrackPublications) {
      if (publication.source == lk.TrackSource.camera && publication.track is lk.VideoTrack && !publication.muted) return publication.track as lk.VideoTrack;
    }
    return null;
  }
  @override Widget build(BuildContext context) { final name = participant.name.isNotEmpty ? participant.name : participant.identity; final video = _video; return Container(clipBehavior: Clip.antiAlias, decoration: BoxDecoration(color: const Color(0xFF24252A), borderRadius: BorderRadius.circular(18), border: participant.isSpeaking ? Border.all(color: const Color(0xFFFFFF99), width: 3) : null), child: Stack(fit: StackFit.expand, children: [if (video != null) lk.VideoTrackRenderer(video) else Center(child: CircleAvatar(radius: 34, backgroundColor: const Color(0xFFFFFAC2), foregroundColor: const Color(0xFF0A0A0A), child: Text(name.substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)))), Align(alignment: Alignment.bottomLeft, child: Container(margin: const EdgeInsets.all(10), padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)), child: Text(name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600))))])); }
}

class _CallControl extends StatelessWidget {
  final IconData icon; final bool active; final bool danger; final VoidCallback onTap;
  const _CallControl({required this.icon, this.active = false, this.danger = false, required this.onTap});
  @override Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(40), child: Container(width: 48, height: 48, decoration: BoxDecoration(shape: BoxShape.circle, color: danger ? Colors.red.shade700 : active ? const Color(0xFFFFFF99) : Colors.white12), child: Icon(icon, color: active && !danger ? const Color(0xFF0A0A0A) : Colors.white)));
}

String _formatWhen(DateTime startsAt) {
  final local = startsAt.toLocal();
  final now = DateTime.now();
  final meetingDay = DateTime(local.year, local.month, local.day);
  final today = DateTime(now.year, now.month, now.day);
  final label = DateFormat('EEEE, d MMMM · h:mm a').format(local);
  final diff = meetingDay.difference(today).inDays;
  if (diff == 0) return 'Today, $label';
  if (diff == 1) return 'Tomorrow, $label';
  return label;
}
