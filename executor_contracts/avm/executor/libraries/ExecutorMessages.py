from algopy import subroutine
from algopy.arc4 import DynamicBytes, UInt16, UInt64

from ...types import Bytes32

REQ_VAA_V1 = b"ERV1"
REQ_NTT_V1 = b"ERN1"

@subroutine
def make_vaa_v1_request(emitter_chain: UInt16, emitter_address: Bytes32, sequence: UInt64) -> DynamicBytes:
    return DynamicBytes(REQ_VAA_V1 + emitter_chain.bytes + emitter_address.bytes + sequence.bytes)

@subroutine
def make_ntt_v1_request(src_chain: UInt16, src_manager: Bytes32, message_id: Bytes32) -> DynamicBytes:
    return DynamicBytes(REQ_NTT_V1 + src_chain.bytes + src_manager.bytes + message_id.bytes)

