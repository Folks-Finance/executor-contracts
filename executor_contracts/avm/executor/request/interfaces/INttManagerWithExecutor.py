from abc import ABC, abstractmethod
from algopy import ARC4Contract, UInt64, gtxn
from algopy.arc4 import Address, DynamicBytes, Struct, abimethod

from ....types import ARC4UInt16


# Structs
class ExecutorArgs(Struct, frozen=True):
    refund_address: Address
    signed_quote_bytes: DynamicBytes
    relay_instructions: DynamicBytes

class FeeArgs(Struct, frozen=True):
    dbps: ARC4UInt16 # The fee in tenths of basis points.
    payee: Address # To whom the fee should be paid (the "referrer").


class INttManagerWithExecutor(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def transfer(
        self,
        ntt_send_token: gtxn.AssetTransferTransaction,
        ntt_transfer: gtxn.ApplicationCallTransaction,
        pay_executor: gtxn.PaymentTransaction,
        pay_referrer: gtxn.AssetTransferTransaction,
        amount: UInt64,
        executor_args: ExecutorArgs,
        fee_args: FeeArgs,
    ) -> None:
        """Transfer a given amount to a recipient on a given chain using the Executor for relaying.

        Args:
            ntt_send_token: Part of the call to NttManager to transfer token. Added here for visibility.
            ntt_transfer: The call to NttManager to transfer token.
            pay_executor: The ALGO payment for the execution.
            pay_referrer: Percentage of token transfer amount to pay to referrer.
            amount: The total amount combining the ntt transfer and referrer pay.
            executor_args: The arguments to be passed into the Executor.
            fee_args: The arguments used to compute the referrer fee.
        """
        pass
