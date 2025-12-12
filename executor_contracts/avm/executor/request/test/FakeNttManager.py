from algopy import ARC4Contract, UInt64, gtxn, op
from algopy.arc4 import Bool, Struct, UInt16, abimethod, emit

from ....types import Bytes32


# Events
class Transfer(Struct):
    succeeds: Bool


class FakeNttManager(ARC4Contract):
    # incorrect on complete
    @abimethod(allow_actions=["OptIn"])
    def transfer(
        self,
        fee_payment: gtxn.PaymentTransaction,
        send_token: gtxn.AssetTransferTransaction,
        amount: UInt64,
        recipient_chain: UInt16,
        recipient: Bytes32
    ) -> Bytes32:
        emit(Transfer(Bool(True)))
        return Bytes32.from_bytes(op.bzero(32))

    # incorrect method signature
    @abimethod
    def incorrect_method_call(self) -> Bytes32:
        emit(Transfer(Bool(True)))
        return Bytes32.from_bytes(op.bzero(32))
