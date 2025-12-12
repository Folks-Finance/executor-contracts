from abc import ABC, abstractmethod
from algopy import ARC4Contract, Bytes, gtxn
from algopy.arc4 import Address, Struct, UInt16, abimethod

from ....types import ARC4UInt64, Bytes32

# Constants
CUSTOM_TOKEN_FEE_PREFIX = b"EQC1"


# Events
class PaymentInToken(Struct):
    asset_id: ARC4UInt64
    amt_paid: ARC4UInt64


class ITokenPaymentExecutor(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def request_execution_with_token_payment(
        self,
        fee_payment: gtxn.AssetTransferTransaction,
        dst_chain: UInt16,
        dst_addr: Bytes32,
        refund_addr: Address,
        signed_quote_bytes: Bytes,
        request_bytes: Bytes,
        relay_instructions: Bytes,
    ) -> None:
        """Request execution of Wormhole message.

        Args:
            fee_payment: The token payment for the execution
            dst_chain: The destination chain
            dst_addr: The destination address
            refund_addr: Where to refund unspent ALGO
            signed_quote_bytes: The signed quote from the executor
            request_bytes: The request to execute
            relay_instructions: The relay instructions
        """
        pass
