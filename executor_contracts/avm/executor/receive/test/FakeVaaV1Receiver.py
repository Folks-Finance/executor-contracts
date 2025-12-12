from algopy import ARC4Contract, gtxn
from algopy.arc4 import Bool, Struct, abimethod, emit


# Events
class VAAReceived(Struct):
    is_called: Bool


class FakeVaaV1Receiver(ARC4Contract):
    # incorrect on complete
    @abimethod(allow_actions=["OptIn"])
    def execute_vaa_v1(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(VAAReceived(Bool(True)))

    # incorrect method signature
    @abimethod
    def incorrect_method(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(VAAReceived(Bool(True)))
