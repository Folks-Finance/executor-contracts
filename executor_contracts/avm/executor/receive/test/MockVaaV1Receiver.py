from algopy import gtxn
from algopy.arc4 import Bool, Struct, abimethod, emit

from ..interfaces.IVaaV1Receiver import IVaaV1Receiver


# Events
class VAAReceived(Struct):
    is_called: Bool


class MockVaaV1Receiver(IVaaV1Receiver):
    @abimethod
    def execute_vaa_v1(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        emit(VAAReceived(Bool(True)))
