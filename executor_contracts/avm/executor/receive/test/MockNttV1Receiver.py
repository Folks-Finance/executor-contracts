from algopy import gtxn
from algopy.arc4 import Bool, Struct, abimethod, emit

from ..interfaces.INttV1Receiver import INttV1Receiver


# Events
class MessageReceived(Struct):
    is_received: Bool


class MockNttV1Receiver(INttV1Receiver):
    @abimethod
    def receive_message(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(MessageReceived(Bool(True)))
