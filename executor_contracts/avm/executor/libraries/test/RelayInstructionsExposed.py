from algopy.arc4 import ARC4Contract, DynamicBytes, UInt128, abimethod

from ....types import Bytes32
from .. import RelayInstructions


class RelayInstructionsExposed(ARC4Contract):
    @abimethod(readonly=True)
    def encode_gas(self, gas_limit: UInt128, msg_val: UInt128) -> DynamicBytes:
        return RelayInstructions.encode_gas(gas_limit, msg_val)

    @abimethod(readonly=True)
    def encode_gas_drop_off(self, drop_off: UInt128, recipient: Bytes32) -> DynamicBytes:
        return RelayInstructions.encode_gas_drop_off(drop_off, recipient)
