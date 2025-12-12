from abc import ABC, abstractmethod
from algopy import ARC4Contract, Bytes, gtxn
from algopy.arc4 import Address, DynamicBytes, Struct, UInt16, abimethod

from ....types import ARC4UInt16, ARC4UInt64, Bytes4, Bytes20, Bytes32


# Structs
class SignedQuoteHeader(Struct, frozen=True):
    prefix: Bytes4
    quoter_address: Bytes20
    payee_address: Address
    src_chain: ARC4UInt16
    dst_chain: ARC4UInt16
    expiry_time: ARC4UInt64


# Events
class RequestForExecution(Struct):
    quoter_address: Bytes20
    amt_paid: ARC4UInt64
    dst_chain: ARC4UInt16
    dst_addr: Bytes32
    refund_addr: Address
    signed_quote_bytes: DynamicBytes
    request_bytes: DynamicBytes
    relay_instructions: DynamicBytes


class IExecutor(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def request_execution(
        self,
        fee_payment: gtxn.PaymentTransaction,
        dst_chain: UInt16,
        dst_addr: Bytes32,
        refund_addr: Address,
        signed_quote_bytes: Bytes,
        request_bytes: Bytes,
        relay_instructions: Bytes,
    ) -> None:
        """Request execution of Wormhole message.

        Args:
            fee_payment: The ALGO payment for the execution
            dst_chain: The destination chain
            dst_addr: The destination address
            refund_addr: Where to refund unspent ALGO
            signed_quote_bytes: The signed quote from the executor
            request_bytes: The request to execute
            relay_instructions: The relay instructions
        """
        pass
