# native_kernel_like_transition_rules — REFERENCE

| Field | Value |
|-------|-------|
| Lab name | `native_kernel_like_transition_rules` |
| Reference owner | Native Kernel (`velantrian/velantrim-native-kernel`) |
| Pinned HEAD | `cd12857df89feb8b95463bc1fe990bebeb462d48` |
| Exact sources (RO) | `native_kernel/semantic_core/authority.py`; `receipt.py`; `models.py`; `reducer.py`; `profile_common/event_envelope.py`; `sqlite_profile/adapter.py` |

## Reproduces (lab)
- Authority: MODEL cannot alone create ACTIVE decision
- Supersession without DELETE
- Provenance via event_id + relations + audit
- Append-style transitions in Lab SQLite only

## Does NOT reproduce
- NK EventType set / claim identity model
- Binary ALLOW/DENY as sole admit surface
- NK runtime, freeze tooling, or Canon promotion
