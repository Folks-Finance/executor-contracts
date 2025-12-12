from algopy import Contract, Txn
from algopy.arc4 import Bool, Struct, emit


# Events
class SigVerified(Struct):
    is_verified: Bool

class VAAVerified(Struct):
    is_verified: Bool


class MockWormholeCore(Contract):
    def approval_program(self) -> bool:
        if Txn.application_id.id:
            match Txn.application_args(0):
                case b"verifySigs":
                    emit(SigVerified(Bool(True)))
                case b"verifyVAA":
                    emit(VAAVerified(Bool(True)))
                case _:
                    return False
        return True

    def clear_state_program(self) -> bool:
        return True
