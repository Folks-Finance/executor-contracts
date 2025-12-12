from algopy import ARC4Contract, gtxn
from algopy.arc4 import Bool, Struct, abimethod, emit


# Events
class MessageReceived(Struct):
    is_received: Bool


class FakeNttV1Receiver(ARC4Contract):
    # incorrect on complete
    @abimethod(allow_actions=["OptIn"])
    def receive_message(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(MessageReceived(Bool(True)))

    # incorrect method signature
    @abimethod
    def incorrect_method(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(MessageReceived(Bool(True)))
