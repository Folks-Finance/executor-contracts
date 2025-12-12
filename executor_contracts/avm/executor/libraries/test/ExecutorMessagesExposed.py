from algopy.arc4 import ARC4Contract, DynamicBytes, UInt16, UInt64, abimethod

from ....types import Bytes32
from .. import ExecutorMessages


class ExecutorMessagesExposed(ARC4Contract):
    @abimethod(readonly=True)
    def make_vaa_v1_request(self, emitter_chain: UInt16, emitter_address: Bytes32, sequence: UInt64) -> DynamicBytes:
        return ExecutorMessages.make_vaa_v1_request(emitter_chain, emitter_address, sequence)

    @abimethod(readonly=True)
    def make_ntt_v1_request(self, src_chain: UInt16, src_manager: Bytes32, message_id: Bytes32) -> DynamicBytes:
        return ExecutorMessages.make_ntt_v1_request(src_chain, src_manager, message_id)
