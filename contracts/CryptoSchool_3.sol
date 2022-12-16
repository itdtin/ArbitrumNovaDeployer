// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract CryptoSchool_3 {
    address public owner;
    mapping(address => uint256) public payments;
    bytes32 internal constant _UNDERLYING_UNIT_SLOT = 0xa66bc57d4b4eed7c7687876ca77997588987307cb13ecc23f5e52725192e5fff;

    constructor() {
        owner = msg.sender;
    }

    function depo() public payable {
        payments[msg.sender] = msg.value;
    }

    function MoneyBack() public {
        address payable _to = payable(owner);
        address _thisContract = address(this);
        _to.transfer(_thisContract.balance);
    }

    receive() external payable {}
}
