from algopy import UInt64
from algopy.arc4 import ARC4Contract, UInt16, abimethod

from .. import MathsUtils


class MathsUtilsExposed(ARC4Contract):
    @abimethod(readonly=True)
    def calculate_fee(self, amount: UInt64, dbps: UInt16) -> UInt64:
        return MathsUtils.calculate_fee(amount, dbps)
